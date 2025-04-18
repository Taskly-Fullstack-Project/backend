const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const prisma = require("../utils/database");

exports.addTask = catchAsync(async (req, res, next) => {
  let project = req.project;
  let authorizedMember = req.user;
  let assignedMemberId = Number(req.body.assignedTo);

  console.log(req.body);

  let member = await prisma.user.findFirst({
    where: {
      id: assignedMemberId,
    },
  });

  if (!member) {
    return next(new AppError("There is no user with the id you provided", 400));
  }

  let projectMember = await prisma.projectMember.findFirst({
    where: {
      projectId: project.id,
      userId: member.id,
      active: true,
      memberStatus: "JOINED",
    },
  });
  if (!projectMember) {
    return next(
      new AppError("The user id you provided doesn't exist in the project", 400)
    );
  }
  const task = await prisma.task.create({
    data: {
      title: req.body.title,
      priority: req.body.priority,
      assignedTo: member.id,
      dueDate: req.body.dueDate,
      description: req.body.description,
      createdBy: authorizedMember.id,
      projectId: req.project.id,
    },
  });
  await notify(
    req,
    projectMember.userId,
    `${req.user.firstName} has assigned a task to you in ${req.project.name} project`,
    "TASKASSIGNMENT",
    task.id
  );
  res.status(201).json({
    status: "success",
    data: {
      task,
    },
  });
});

exports.updateTask = catchAsync(async (req, res, next) => {
  const allowedFields = [
    "title",
    "description",
    "priority",
    "dueDate",
    "status",
  ];
  const filteredBody = {};

  const taskId = req.task.id;

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      status: {
        not: "CLOSED",
      },
      active: true,
    },
  });

  if (!task) {
    return next(
      new AppError(
        "The task id you provided is invalid or it has been closed",
        400
      )
    );
  }

  if (req.user.id !== req.project.managerId && req.user.id !== task.createdBy) {
    return next(
      new AppError("You are not authorized to update that task", 403)
    );
  }

  Object.keys(req.body).forEach((k) => {
    if (allowedFields.includes(k)) {
      filteredBody[k] = req.body[k];
    }
  });

  if (filteredBody.status === "ASSIGNED") {
    return next(new AppError("You can not update the task as Assigned", 400));
  }

  const updatedTask = await prisma.task.update({
    where: {
      id: task.id,
    },
    data: filteredBody,
  });

  await notify(
    req,
    updatedTask.assignedTo,
    `${req.user.username} has updated the task assigned to you in project ${req.project.name} please check the updates`,
    "TASKUPDATE",
    updatedTask.id
  );

  res.status(200).json({
    status: "success",
    data: {
      task: updatedTask,
    },
  });
});
exports.deleteTask = catchAsync(async (req, res, next) => {
  const taskId = req.task.id;

  // ✅ Soft delete (if you want to keep the task in the database)
  await prisma.task.update({
    where: { id: taskId },
    data: { active: false },
  });

  await notify(
    req,
    req.task.assignedTo,
    `${req.user.username} has removed the task (${req.task.title}) assigned to you in project ${req.project.name} please check the updates`,
    "TASKREMOVAL",
    req.task.id
  );

  res.status(200).json({
    status: "success",
    message: "Task has been successfully deleted.",
  });
});

exports.getAllTasks = catchAsync(async (req, res, next) => {
  const tasks = await prisma.task.findMany({
    where: {
      projectId: req.project.id,
      active: true,
    },
    select: {
      id: true,
      title: true,
      description: true,
      dueDate: true,
      priority: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      member: {
        select: {
          user: {
            select: {
              username: true,
              photo: true,
              id: true,
              email: true,
            },
          },
        },
      },
      creator: {
        select: {
          user: {
            select: {
              username: true,
              photo: true,
              id: true,
              email: true,
            },
          },
        },
      },
    },
  });
  res.status(200).json({
    status: "success",
    data: {
      projectManager: req.project.managerId,
      tasks: tasks,
    },
  });
});

exports.getAssignedTasks = catchAsync(async (req, res, next) => {
  const user = req.user;

  const tasks = await prisma.task.findMany({
    where: {
      assignedTo: user.id,
      projectId: req.params.id,
      active: true,
    },
    orderBy: {
      dueDate: "asc",
    },
    select: {
      id: true,
      title: true,
      description: true,
      dueDate: true,
      status: true,
      priority: true,
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      creator: {
        select: {
          user: {
            select: {
              username: true,
              email: true,
              photo: true,
            },
          },
        },
      },
      createdAt: true,
    },
  });

  res.status(200).json({
    status: "success",
    data: {
      tasks,
    },
  });
});

exports.myTasks = catchAsync(async (req, res, next) => {
  const user = req.user;
  const tasks = await prisma.task.findMany({
    where: {
      assignedTo: user.id,
      active: true,
    },
    orderBy: {
      dueDate: "asc",
    },
    select: {
      id: true,
      title: true,
      description: true,
      dueDate: true,
      status: true,
      priority: true,
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      creator: {
        select: {
          user: {
            select: {
              username: true,
              email: true,
              photo: true,
            },
          },
        },
      },
      createdAt: true,
    },
  });
  res.status(200).json({
    status: "success",
    data: { tasks },
  });
});

exports.checkTaskExistanceAndAccess = catchAsync(async (req, res, next) => {
  const taskId = Number(req.params.taskId);

  // Check if task exists
  const task = await prisma.task.findFirst({
    where: { id: taskId, active: true },
    select: {
      id: true,
      assignedTo: true,
      title: true,
      createdBy: true,
    },
  });

  if (!task) {
    return next(
      new AppError("The task id is invalid or no longer exists", 400)
    );
  }

  // Check user access
  const isTaskAssignedToThatUser = task.assignedTo === req.user.id;

  const projectMembership = await prisma.projectMember.findFirst({
    where: {
      active: true,
      userId: req.user.id,
      projectId: req.project.id,
    },
  });

  if (!projectMembership) {
    return next(new AppError("You are not part of that project!", 403));
  }

  const isUserManagerOrSupervisor =
    projectMembership.role === "MANAGER" ||
    projectMembership.role === "SUPERVISOR";

  if (!isTaskAssignedToThatUser && !isUserManagerOrSupervisor) {
    return next(new AppError("You are forbidden to access that resource", 403));
  }

  req.task = task;
  req.projectMembership = projectMembership;

  next();
});

exports.managerialAccess = catchAsync(async (req, res, next) => {
  if (
    !req.user.projectRole === "MANAGER" &&
    !req.user.projectRole === "SUPERVISOR"
  ) {
    return next(new AppError("Sorry you can't perform this action", 403));
  }
  next();
});

exports.getTask = catchAsync(async (req, res, next) => {
  const task = await prisma.task.findFirst({
    where: {
      id: req.task.id,
    },
    select: {
      id: true,
      title: true,
      description: true,
      dueDate: true,
      priority: true,
      createdAt: true,
      comments: true,
      status: true,
      member: {
        select: {
          role: true,
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              photo: true,
            },
          },
        },
      },
      creator: {
        select: {
          role: true,
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              photo: true,
            },
          },
        },
      },
    },
  });
  res.status(200).json({
    status: "success",
    data: {
      task: task,
      projectManager: req.project.managerId,
    },
  });
});

exports.updateAuthority = catchAsync(async (req, res, next) => {
  if (
    req.user.projectRole !== "MANAGER" &&
    req.task.createdBy !== req.user.id
  ) {
    return next(new AppError("Sorry you can't perform this action", 403));
  }
  next();
});

exports.deleteAuthority = catchAsync(async (req, res, next) => {
  if (req.user.projectRole !== "MANAGER") {
    return next(new AppError("Sorry you can't perform this action", 403));
  }
  next();
});

const notify = async (req, userId, message, notificationType, taskId) => {
  const notification = await prisma.notification.create({
    data: {
      userId: userId,
      message: message,
      targetType: "TASK",
      type: notificationType,
      projectId: req.project.id,
      taskId: taskId,
    },
  });

  if (req.app.get("socket")) {
    req.app.get("socket").sendNotifications(userId, notification);
  }
};

exports.doesItAssignedToMe = (req, res, next) => {
  console.log(req.task);

  if (req.task.assignedTo !== req.user.id) {
    return next(
      new AppError("Sorry you are forbidden to enter that route", 403)
    );
  }
  next();
};

exports.doneTask = catchAsync(async (req, res, next) => {
  const updatedTask = await prisma.task.update({
    where: {
      id: req.task.id,
    },
    data: {
      status: "FINISHED",
    },
  });
  notify(
    req,
    updatedTask.createdBy,
    `${req.user.username} has finished the task assigned to him ${updatedTask.title}`,
    "TASKUPDATE",
    updatedTask.id
  );
  res.status(200).json({
    status: "success",
    message: "The task has been done successfully",
  });
});

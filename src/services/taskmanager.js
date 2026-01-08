import TaskRepository from "../repositories/tasks.repository.js";



class TaskManager {
  static repository = null;

  constructor() {
    if(!TaskManager.repository) {
      TaskManager.repository = new TaskRepository();
    }
  }

  async addTask(className, functionName, args, retries_count = 5) {

    await this.ensureClassAndFunctionExists(className, functionName);

    const task = await TaskManager.repository.createTask({
      className,
      functionName,
      arguments: args,
      status: 'UNPROCESSED',
      retries_count,
      retries: 0
    });
    return task;    
  }

  getTask(task) {
    this.tasks.push(task);
  }
  executeTask(task) {
    if(task.retries >= task.retries_count) {
      throw new Error('Task retries exceeded');
    }

    if(task.status !== 'UNPROCESSED' && task.status !== 'ERROR') {
      throw new Error('Task already processed');
    }


  }


  camelToSnake(str) {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
  }

  async ensureClassAndFunctionExists(className, functionName) {
    let MyClass = null;
    try {
      MyClass = await import(this.camelToSnake(className));
    } catch (error) {
      throw new Error('Class not found');
    }
    const instanceMyclass = new MyClass();

    if(!instanceMyclass[functionName]) {
      throw new Error('Function not found');
    }
    return instanceMyclass;
  }

}
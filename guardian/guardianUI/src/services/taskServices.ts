
export type TaskData = {
    taskId: string
    status: string
    assigned: string
    description: string
}

export const fetchTasks = async (requestId: number) : Promise<TaskData[]> => {
    const response = await fetch('foo');
   
    let data = [
        {
            taskId: '1',
            status: 'Pending',
            assigned: 'John Doe',
            description: 'This is a description'
        },
        {
            taskId: '2',
            status: 'Complete',
            assigned: 'Jane Doe',
            description: 'This is a description'
        },
        {
            taskId: '3',
            status: 'Cancel',
            assigned: 'John Doe',
            description: 'This is a description'
        },
        {
            taskId: '4',
            status: 'Pending',
            assigned: 'Jane Doe',
            description: 'This is a description'
        }
    ]
    return Promise.resolve(data);
}

export type AddTaskData = {
    requestId: number
    assigned?: string
    description: string
}

export const addTask = async (data: AddTaskData) : Promise<void> => {
    const response = await fetch('foo');
    return Promise.resolve();
}

export const startTask = async (taskId: string) : Promise<void> => {
    const response = await fetch('foo');
    return Promise.resolve();
}

export const completeTask = async (taskId: string) : Promise<void> => {
    const response = await fetch('foo');
    return Promise.resolve();
}

export const cancelTask = async (taskId: string) : Promise<void> => {
    const response = await fetch('foo');
    return Promise.resolve();
}

export const assignTask = async (taskId: string, assigned: string) : Promise<void> => {
    const response = await fetch('foo');
    return Promise.resolve();
}



export type RequestOverviewData = {
    total: number
    completed: number
    inProgress: number
    pending: number
}

export const fetchRequestOverview  = async () : Promise<RequestOverviewData> => {

    const response = await fetch('foo');

   
    let data =         {
            total: 420,
            completed: 68,
            inProgress: 1,
            pending: 0
        }

    return Promise.resolve(data);
}

export type RequestQueueItem = {
    status: string
    requestor: string
    requestType: string
    createDate: string
    priority: string
}

export const fetchRequestsQueue = async () : Promise<RequestQueueItem[]> => {

    const response = await fetch('foo');
   
    let data = [
        {
            status: 'In Progress',
            requestor: 'John Doe',
            requestType: 'New License',
            createDate: '2021-10-01',
            priority: 'High'
        },
        {
            status: 'Pending',
            requestor: 'Jane Doe',
            requestType: 'New License',
            createDate: '2021-10-01',
            priority: 'High'
        },
        {
            status: 'Completed',
            requestor: 'John Doe',
            requestType: 'New License',
            createDate: '2021-10-01',
            priority: 'High'
        },
        {
            status: 'In Progress',
            requestor: 'Jane Doe',
            requestType: 'New License',
            createDate: '2021-10-01',
            priority: 'High'
        }
    ]

    return Promise.resolve(data);
}

export type NoticeLandingData = {
    category: string
    title: string
    from: string
    createDate: string
    priority: string
}

export const fetchNoties = async () : Promise<NoticeLandingData[]> => {

    const response = await fetch('foo');
   
    let data = [
        {
            category: 'Maintenance',
            title: 'Scheduled Maintenance',
            from: 'IT',
            createDate: '2021-10-01',
            priority: 'High'
        },
        {
            category: 'Outage',
            title: 'Network Outage',
            from: 'IT',
            createDate: '2021-10-01',
            priority: 'High'
        },
        {
            category: 'Maintenance',
            title: 'Scheduled Maintenance',
            from: 'IT',
            createDate: '2021-10-01',
            priority: 'High'
        },
        {
            category: 'Outage',
            title: 'Network Outage',
            from: 'IT',
            createDate: '2021-10-01',
            priority: 'High'
        }
    ]

    return Promise.resolve(data);
}
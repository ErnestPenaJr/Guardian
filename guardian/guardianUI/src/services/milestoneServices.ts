// Within the request details, there needs to be a tab Milestones containing a data table  


// • Task  • Event   • Date/Time   • By   • Notes  
// 
// Events will includes  • Submission   • Start   • Assign  
// • Complete   • Cancel   • Deny   • Approve   • Attachment Added   • Tasks     ◦ Add Task     ◦ Assign Task     
// ◦ Complete Task     ◦ Cancel Task  

export type MilestoneData = {
    // task: string
    event: string
    createDate: string
    by: string
    notes: string
}

export const fetchMilestoneTypes = async () : Promise<string[]> => {

    let data = [
        'Submission',
        'Start',
        'Assign',
        'Complete',
        'Cancel',
        'Deny',
        'Approve',
        'Attachment Added',
        'Tasks',
        'Add Task',
        'Assign Task',
        'Complete Task',
        'Cancel Task'
    ]

    return Promise.resolve(data);
}

export const fetchMilestones = async (requestId: number) : Promise<MilestoneData[]> => {
    const response = await fetch('foo');
   
    let data = [
        {
            // task: 'Add Task',
            event: 'Submission',
            createDate: '2021-10-01',
            by: 'John Doe',
            notes: 'This is a note'
        },
        {
            // task: 'Assign Task',
            event: 'Start',
            createDate: '2021-10-01',
            by: 'Jane Doe',
            notes: 'This is a note'
        },
        {
            // task: 'Complete Task',
            event: 'Assign',
            createDate: '2021-10-01',
            by: 'John Doe',
            notes: 'This is a note'
        },
        {
            // task: 'Cancel Task',
            event: 'Complete',
            createDate: '2021-10-01',
            by: 'Jane Doe',
            notes: 'This is a note'
        }
    ]

    return Promise.resolve(data);
}



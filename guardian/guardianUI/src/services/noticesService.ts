


export type NoticeData = {
    title: string
    noticeType: string
    issuedDate: string
    issuedBy: string
    issuedTeam: string
    recipient: string
}

export const fetchNotices = async () : Promise<NoticeData[]> => {
    const response = await fetch('foo');
   
    let data = [
        {
            title: 'Notice 1',
            noticeType: 'Information',
            issuedDate: '2021-10-01',
            issuedBy: 'John Doe',
            issuedTeam: 'Team 1',
            recipient: 'Jane Doe'
        },
        {
            title: 'Notice 2',
            noticeType: 'Information',
            issuedDate: '2021-10-01',
            issuedBy: 'Jane Doe',
            issuedTeam: 'Team 2',
            recipient: 'John Doe'
        },
        {
            title: 'Notice 3',
            noticeType: 'Information',
            issuedDate: '2021-10-01',
            issuedBy: 'John Doe',
            issuedTeam: 'Team 1',
            recipient: 'Jane Doe'
        },
        {
            title: 'Notice 4',
            noticeType: 'Information',
            issuedDate: '2021-10-01',
            issuedBy: 'Jane Doe',
            issuedTeam: 'Team 2',
            recipient: 'John Doe'
        }
    ]

    return Promise.resolve(data);
}

export const createNotice = () => {
    return Promise.resolve();
}
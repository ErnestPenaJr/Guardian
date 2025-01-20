



export const inviteUser = async (email: string) => {
    const response = await fetch('http://localhost:3000/invite', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
    });
    return response.json();
}


export const saveWorkflow = async (data: any) => {
    const response = await fetch('http://localhost:3000/workflows');
    return response.json();
}

export const editWorkflow = async (data: any) => {
    const response = await fetch('http://localhost:3000/workflows');
    return response.json();
}

export const fetchWorkflows = async () => {
    const response = await fetch('http://localhost:3000/workflows');
    return response.json();
}
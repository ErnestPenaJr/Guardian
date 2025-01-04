



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
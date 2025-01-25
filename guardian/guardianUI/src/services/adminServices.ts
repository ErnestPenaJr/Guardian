
import { apiRoot, handleResponse, jsonHeader } from "./serviceUtils"

export const inviteUser = async (email: string) => {
    const response = await fetch(`${apiRoot}/invite`, {
        method: 'POST',
        ...jsonHeader,
        body: JSON.stringify({ email })
    });
    
    return response.json();
}



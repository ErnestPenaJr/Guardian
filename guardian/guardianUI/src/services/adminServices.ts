
import { apiRoot, handleResponse, jsonHeader } from "./serviceUtils"

export const inviteUser = async (email: string) => {
    const response = await fetch(`${apiRoot}/invite`, {
        method: 'POST',
        ...jsonHeader,
        body: JSON.stringify({ email })
    });

    return response.json();
}
export type UserGridData = {
    id: number;
    lastName: string;
    firstName: string;
    email: string;
    role: string;
    userStatus: string;
};


export const fetchUsers = () : Promise<UserGridData[]> => 
    fetch(`${apiRoot}/users`,{
        method: 'GET',
        ...jsonHeader
    }).then(resp => handleResponse(resp));

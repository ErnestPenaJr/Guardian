

export type RoleData = {
    roleId: number
    roleName: string
}

export const fetchRoles = async () : Promise<RoleData[]> => {
    const response = await fetch('/api/roles');

    if (response.ok) {
        return response.json();
    }

    return Promise.resolve([]);
}

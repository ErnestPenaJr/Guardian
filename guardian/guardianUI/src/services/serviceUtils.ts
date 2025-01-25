
export const apiRoot = import.meta.env.MODE == "development" ? "/api" : `${import.meta.env.BASE_URL}/api`;

export const jsonHeader = {
    headers: {
        'Content-Type': 'application/json'
    }
}

export const handleResponse = (resp: Response) => {
    if (resp.ok) {
        const contentType = resp.headers.get('Content-Type');
        return contentType?.includes('application/json') ? resp.json() : resp.text();
    }
    //think about this one
    return Promise.reject(resp.statusText);

    //throw new Error('Server error: ${resp.status} ${resp.body}');
}

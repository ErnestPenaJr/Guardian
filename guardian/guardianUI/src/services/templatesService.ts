import { apiRoot, handleResponse, jsonHeader } from "./serviceUtils"


export const fetchTemplates = async () => {
    const response = await fetch('http://localhost:3000/templates');
    return response.json();
}

export const fetchTemplate = async (id: string) => {
    const response = await fetch(`http://localhost:3000/templates/${id}`);
    return response.json();
}

export const fetchRequestTemplates = async () => {
    const response = await fetch('http://localhost:3000/requestTemplates');
    return response.json();
}

export const fetchNoticeTemplates = async () => {
    const response = await fetch('http://localhost:3000/requestTemplates');
    return response.json();
}

export const fetchSelfServiceTemplates = async () => {
    const response = await fetch('http://localhost:3000/requestTemplates');
    return response.json();
}
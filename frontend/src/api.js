import axios from "axios";
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });
api.interceptors.request.use(config => { const token = localStorage.getItem("ac_token"); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
export default api;

api.interceptors.response.use(r=>r,error=>{if(error.response?.status===401){localStorage.removeItem("ac_token");}window.dispatchEvent(new CustomEvent('api-error',{detail:error.response?.data?.message||'Connection unavailable. Please retry.'}));return Promise.reject(error)});

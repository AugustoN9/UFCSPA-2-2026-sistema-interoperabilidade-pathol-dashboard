import { CONFIG } from './config.js';

export class ApiService {
    constructor() {
        this.authHeader = "Basic " + btoa(`${CONFIG.AUTH_USER}:${CONFIG.AUTH_PASS}`);
    }

    async buscarTodosExames() {
        const response = await fetch(CONFIG.API_BASE_URL, {
            headers: {
                "Authorization": this.authHeader,
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`Erro de conexão ou autenticação: ${response.status}`);
        }

        return await response.json();
    }
}
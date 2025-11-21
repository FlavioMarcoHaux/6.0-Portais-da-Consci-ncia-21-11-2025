// utils/errorUtils.ts
import { useStore } from '../store.ts';

/**
 * Parses Gemini API errors and returns a user-friendly message.
 * Crucially, it also triggers global state changes for critical errors like API key failures.
 * @param error The error object from a catch block.
 * @param defaultMessage A fallback message.
 * @returns A user-friendly error string.
 */
export const getFriendlyErrorMessage = (error: any, defaultMessage: string): string => {
    console.error("Handling Gemini Error:", error);

    // 1. Handle Microphone/Device errors first (DOMException)
    if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
            return 'A permissão para usar o microfone foi negada. Por favor, verifique as permissões do seu navegador e do seu sistema operacional (Windows/macOS) e tente novamente.';
        }
        if (error.name === 'NotFoundError') {
            return 'Nenhum microfone foi encontrado. Por favor, conecte um microfone e tente novamente.';
        }
        // Other DOMExceptions can be handled here if needed
    }

    // 2. Extract string message from various other error formats
    let errorMessage = '';
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else if (error?.error?.message) {
        errorMessage = error.error.message;
    } else if (error?.message) { // Handle cases where error is an object with a message property
        errorMessage = error.message;
    } else if (error && typeof error.toString === 'function') {
        errorMessage = error.toString();
    }
    
    const lowerCaseError = errorMessage.toLowerCase();

    // 3. Check for Microphone/System Permission errors specifically first
    // This prevents them from being caught by the generic "permission_denied" check below for API keys.
    if (
        errorMessage.includes('Permission denied by system') || 
        lowerCaseError.includes('microphone') || 
        lowerCaseError.includes('microfone') || 
        lowerCaseError.includes('audio device')
    ) {
         return 'A permissão para usar o microfone foi negada pelo sistema operacional. Verifique as configurações de privacidade do seu dispositivo (Windows/macOS) para permitir o acesso ao microfone pelo navegador.';
    }

    // 4. Handle specific string-based errors that require user action (API Key/Billing)
    if (
        lowerCaseError.includes('api key not found') ||
        (lowerCaseError.includes('permission_denied') && !lowerCaseError.includes('system')) || // Check for API permission, excluding system/OS permission
        lowerCaseError.includes('requested entity was not found') ||
        lowerCaseError.includes('resource_exhausted') || // Billing limit reached
        lowerCaseError.includes('429') // Another indicator for quota/billing
    ) {
        // Trigger the global state to show the API key selector modal
        useStore.getState().requireApiKeySelection();
        return "Sua chave de API é inválida ou o limite de faturamento foi atingido. Por favor, selecione uma chave de API válida para continuar.";
    }

    // 5. Handle other common, non-blocking errors
    if (lowerCaseError.includes('network error')) {
        return 'Erro de rede. Verifique sua conexão com a internet e tente novamente. Se o problema persistir, pode haver uma instabilidade no serviço.';
    }
    
    if (lowerCaseError.includes("400") && (lowerCaseError.includes("invalid") || lowerCaseError.includes("request is invalid"))){
        return `Ocorreu um erro de requisição inválida. Por favor, verifique os dados e tente novamente.`
    }

    // 6. Return default if no specific case matched
    return defaultMessage;
};
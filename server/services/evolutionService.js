export async function evolutionRequest(baseUrl, apiKey, endpoint, method = 'GET', body = null) {
    const url = `${baseUrl}${endpoint}`;
    const options = {
        method,
        headers: { 'Content-Type': 'application/json', 'apikey': apiKey }
    };
    if (body) options.body = JSON.stringify(body);

    console.log(`[EVOLUTION API] ${method} ${url}`);
    const response = await fetch(url, options);
    let data;

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        data = await response.json();
    } else {
        const text = await response.text();
        data = { message: text.slice(0, 100) };
    }

    if (!response.ok) {
        console.error('[EVOLUTION API ERROR]', JSON.stringify(data, null, 2));
        throw new Error(data.message || data.error || `Erro da Evolution API: ${response.status}`);
    }
    return data;
}

export const getStatus = async (userConfig) => {
    const statusData = await evolutionRequest(
        userConfig.evolutionApiUrl,
        userConfig.evolutionApiKey,
        `/instance/connectionState/${userConfig.evolutionInstanceName}`
    );
    return statusData.state === 'open' || statusData.instance?.state === 'open';
};

export const logoutInstance = async (userConfig) => {
    return await evolutionRequest(
        userConfig.evolutionApiUrl,
        userConfig.evolutionApiKey,
        `/instance/logout/${userConfig.evolutionInstanceName}`,
        'DELETE'
    );
};

export const fetchQR = async (userConfig) => {
    const qrData = await evolutionRequest(
        userConfig.evolutionApiUrl,
        userConfig.evolutionApiKey,
        `/instance/connect/${userConfig.evolutionInstanceName}`
    );
    return qrData.base64 || qrData.qrcode?.base64 || qrData.qr || null;
};

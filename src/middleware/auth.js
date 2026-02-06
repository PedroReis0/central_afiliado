import jwt from 'jsonwebtoken';

function requiredEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} not configured in .env`);
    return value;
}

export function verifyJwt(request, reply, done) {
    try {
        const authHeader = request.headers['authorization'];
        if (!authHeader) {
            return reply.code(401).send({ ok: false, error: 'missing_authorization_header' });
        }

        const token = authHeader.replace(/^Bearer\s+/, '');
        if (!token) {
            return reply.code(401).send({ ok: false, error: 'invalid_token_format' });
        }

        const secret = requiredEnv('UAA_JWT_SECRET'); // Using a general name, can be changed
        const decoded = jwt.verify(token, secret);

        request.user = decoded;
        done();
    } catch (err) {
        return reply.code(401).send({ ok: false, error: 'invalid_token' });
    }
}

export function verifyEvolutionKey(request, reply, done) {
    try {
        const apiKey = request.headers['apikey'];
        if (!apiKey) {
            request.log.warn('Tentativa de acesso ao webhook sem apikey');
            return reply.code(401).send({ ok: false, error: 'missing_apikey' });
        }

        const expectedKey = requiredEnv('EVOLUTION_API_KEY');
        if (apiKey !== expectedKey) {
            request.log.warn('Tentativa de acesso ao webhook com apikey invalida');
            return reply.code(403).send({ ok: false, error: 'invalid_apikey' });
        }

        done();
    } catch (err) {
        request.log.error(err);
        return reply.code(500).send({ ok: false, error: 'internal_error' });
    }
}

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';

export function registerAuthRoutes(app) {
    app.post('/api/auth/login', async (request, reply) => {
        const { email, password } = request.body || {};

        if (!email || !password) {
            return reply.code(422).send({ success: false, error: 'email_password_required' });
        }

        try {
            const res = await query('SELECT id, email, password_hash, role FROM users WHERE email = $1', [email]);
            if (res.rowCount === 0) {
                return reply.code(401).send({ success: false, error: 'invalid_credentials' });
            }

            const user = res.rows[0];
            const valid = await bcrypt.compare(password, user.password_hash);

            if (!valid) {
                return reply.code(401).send({ success: false, error: 'invalid_credentials' });
            }

            const secret = process.env.UAA_JWT_SECRET;
            if (!secret) {
                app.log.error('UAA_JWT_SECRET not configured');
                return reply.code(500).send({ success: false, error: 'server_configuration_error' });
            }

            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role },
                secret,
                { expiresIn: '8h' }
            );

            return reply.send({
                success: true,
                data: {
                    token,
                    user: {
                        id: user.id,
                        email: user.email,
                        role: user.role
                    }
                }
            });

        } catch (err) {
            app.log.error(err);
            return reply.code(500).send({ success: false, error: 'login_error' });
        }
    });

    app.get('/api/auth/me', { preHandler: [app.verifyJwt] }, async (request, reply) => {
        return reply.send({
            success: true,
            data: request.user
        });
    });
}

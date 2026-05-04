import { Body, Controller, Get, Post, Req, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { auth } from '@/lib/auth';
import prisma from '@/prisma/prisma.service';
import { hashPassword } from 'better-auth/crypto';

@Controller('auth-extended')
export class AuthExtendedController {

    // ⚠️ TEMPORARY — will be removed after password reset
    @Get('emergency-reset')
    @SetMetadata('PUBLIC', true)
    async emergencyReset() {
        const email = 'noam.schlanger@gmail.com';
        const newPassword = '12345678';

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return { ok: false, error: 'User not found' };

        const hashed = await hashPassword(newPassword);
        const result = await prisma.account.updateMany({
            where: { userId: user.id, providerId: 'credential' },
            data: { password: hashed },
        });

        if (result.count === 0) return { ok: false, error: 'No credential account found' };
        return { ok: true, message: `Done! Password for ${email} is now: ${newPassword}` };
    }

    @Post('set-password')
    async setPassword(
        @Req() req: Request,
        @Body() body: { newPassword: string },
    ) {
        if (!body.newPassword || body.newPassword.length < 8) {
            throw new UnauthorizedException('Password must be at least 8 characters');
        }

        try {
            await auth.api.setPassword({
                body: { newPassword: body.newPassword },
                headers: req.headers as any,
            });
            return { success: true, message: 'Password set successfully' };
        } catch (error) {
            console.error('Error setting password:', error);
            throw new UnauthorizedException('Failed to set password');
        }
    }
}

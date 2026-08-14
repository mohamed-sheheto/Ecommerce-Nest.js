import { Reflector } from '@nestjs/core';
import { Role } from '../roles';

export const Roles = Reflector.createDecorator<Role[]>();
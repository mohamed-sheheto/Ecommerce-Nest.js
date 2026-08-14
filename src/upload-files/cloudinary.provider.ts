// cloudinary.provider.ts

import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';

export const CloudinaryProvider = {
  provide: 'CLOUDINARY',
  useFactory: () => {
    return cloudinary.config({
      cloud_name: env.CLOUDINARY_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
    });
  },
};
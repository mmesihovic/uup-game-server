import { Pool } from 'pg';
import { config } from './dbconfig';

export const connectionPool = new Pool(config);
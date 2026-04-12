import { Hono } from 'hono';
import { adapt } from '../legacy';
import * as generationTemplatesRoute from '@/app/api/generation/templates/route';
import * as generationTemplateDetailRoute from '@/app/api/generation/templates/[id]/route';
import * as generationBestPracticesRoute from '@/app/api/generation/best-practices/route';
import * as generationBestPracticeDetailRoute from '@/app/api/generation/best-practices/[id]/route';
import * as generationWeeklyReportRoute from '@/app/api/generation/weekly-report/route';
import * as generationDoorayRoute from '@/app/api/generation/dooray/route';

const generationRoutes = new Hono();

generationRoutes.get('/api/generation/templates', adapt(generationTemplatesRoute.GET));
generationRoutes.post('/api/generation/templates', adapt(generationTemplatesRoute.POST));
generationRoutes.put('/api/generation/templates/:id', adapt(generationTemplateDetailRoute.PUT));
generationRoutes.delete('/api/generation/templates/:id', adapt(generationTemplateDetailRoute.DELETE));

generationRoutes.get('/api/generation/best-practices', adapt(generationBestPracticesRoute.GET));
generationRoutes.post('/api/generation/best-practices', adapt(generationBestPracticesRoute.POST));
generationRoutes.put('/api/generation/best-practices/:id', adapt(generationBestPracticeDetailRoute.PUT));
generationRoutes.delete('/api/generation/best-practices/:id', adapt(generationBestPracticeDetailRoute.DELETE));

generationRoutes.post('/api/generation/weekly-report', adapt(generationWeeklyReportRoute.POST));
generationRoutes.post('/api/generation/dooray', adapt(generationDoorayRoute.POST));

export default generationRoutes;


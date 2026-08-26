import { z } from 'zod';

export const SaveDashboardPreferenceSchema = z.object({
  widgetLayout: z.record(z.any())
});

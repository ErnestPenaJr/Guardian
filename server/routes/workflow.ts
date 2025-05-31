import express from 'express';
import { PrismaClient } from '@prisma/client';
import { isProcessor, filterToProcessorGroup } from '../middleware/isProcessor';
import { z } from 'zod';

const router = express.Router();
const prisma = new PrismaClient();

// Validation schema for workflow step completion
const workflowStepSchema = z.object({
  requestId: z.number(),
  stepId: z.number(),
  status: z.string(),
  comments: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});

// Get all workflow items assigned to processor's group
router.get('/workflow/items', isProcessor, filterToProcessorGroup, async (req, res) => {
  try {
    // @ts-ignore
    const companyFilter = req.companyFilter;
    
    // Build query based on filters
    const whereClause: any = {};
    
    // If processor, filter by company
    if (companyFilter) {
      whereClause.COMPANY_ID = companyFilter;
    }
    
    // Add status filter for pending items
    whereClause.STATUS = 'P';
    
    // Get requests with requestor and assigned user details
    const workflowItems = await prisma.rEQUESTS.findMany({
      where: whereClause,
      orderBy: { SUBMITTED_DATE: 'desc' },
      select: {
        REQUEST_ID: true,
        REQUEST_NAME: true,
        SUBMITTED_DATE: true,
        STATUS: true,
        REQUESTOR_ID: true,
        ASSIGNED_ID: true,
        TRACKINGID: true
      }
    });
    
    // Format the response
    const formattedItems = workflowItems.map(item => ({
      REQUEST_ID: item.REQUEST_ID,
      REQUEST_NAME: item.REQUEST_NAME,
      SUBMITTED_DATE: item.SUBMITTED_DATE,
      STATUS: item.STATUS,
      REQUESTOR_ID: item.REQUESTOR_ID,
      ASSIGNED_ID: item.ASSIGNED_ID,
      REQUESTOR_NAME: item.REQUESTOR_ID ? `User ID: ${item.REQUESTOR_ID}` : null,
      ASSIGNED_NAME: item.ASSIGNED_ID ? `User ID: ${item.ASSIGNED_ID}` : null,
      TRACKINGID: item.TRACKINGID
    }));
    
    res.json(formattedItems);
  } catch (error) {
    console.error('Error fetching workflow items:', error);
    res.status(500).json({ message: 'Failed to fetch workflow items' });
  }
});

// Process a workflow step
router.post('/workflow/process', isProcessor, async (req, res) => {
  try {
    // Validate input
    const validationResult = workflowStepSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Invalid workflow step data', 
        errors: validationResult.error.errors 
      });
    }

    const { requestId, stepId, status, comments } = validationResult.data;
    
    // Check if request exists
    const request = await prisma.rEQUESTS.findUnique({
      where: { REQUEST_ID: requestId }
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    
    // Check if user belongs to the same company as the request
    // @ts-ignore
    const userCompanyId = req.user?.COMPANY_ID;
    // Using type assertion since COMPANY_ID is not in the Prisma model but exists at runtime
    if ((request as any).COMPANY_ID !== userCompanyId && req.user?.role !== '1') {
      return res.status(403).json({ 
        message: 'You can only process workflows for your own group/organization' 
      });
    }
    
    // Update the workflow step status
    await prisma.$executeRaw`
      UPDATE WORKFLOW_STEPS
      SET STATUS = ${status},
          COMMENTS = ${comments || null},
          PROCESSED_BY = ${(req.user as any)?.id || null},
          PROCESSED_DATE = ${new Date()}
      WHERE STEP_ID = ${stepId} AND REQUEST_ID = ${requestId}
    `;
    
    // Check if this is the last step in the workflow
    const remainingSteps = await prisma.$queryRaw`
      SELECT COUNT(*) as remaining
      FROM WORKFLOW_STEPS
      WHERE REQUEST_ID = ${requestId} AND STATUS = 'P'
    `;
    
    // If no remaining steps, update the request status to completed
    if ((remainingSteps as any)[0].remaining === 0) {
      await prisma.rEQUESTS.update({
        where: { REQUEST_ID: requestId },
        data: {
          STATUS: 'C',
          UPDATE_USER_ID: (req.user as any)?.id || null,
          UPDATE_DATE: new Date()
        }
      });
    }
    
    // Create a task for the next step if needed
    const nextStep = await prisma.$queryRaw`
      SELECT TOP 1 *
      FROM WORKFLOW_STEPS
      WHERE REQUEST_ID = ${requestId} AND STATUS = 'P'
      ORDER BY STEP_ORDER
    `;
    
    if ((nextStep as any)[0]) {
      const nextStepData = (nextStep as any)[0];
      
      // Create a task for the next step
      await prisma.tASKS.create({
        data: {
          REQUEST_ID: requestId,
          DESCRIPTION: `Process workflow step: ${nextStepData.STEP_NAME}`,
          STATUS: 'P',
          ASSIGNED_USER_ID: nextStepData.ASSIGNED_USER_ID || (req.user as any)?.id || null,
          CREATE_USER_ID: (req.user as any)?.id || null,
          UPDATE_USER_ID: (req.user as any)?.id || null,
          CREATE_DATE: new Date(),
          UPDATE_DATE: new Date()
        }
      });
    }
    
    res.json({ 
      message: 'Workflow step processed successfully',
      isComplete: (remainingSteps as any)[0].remaining === 0
    });
  } catch (error) {
    console.error('Error processing workflow step:', error);
    res.status(500).json({ message: 'Failed to process workflow step' });
  }
});

// Get workflow steps for a request
router.get('/workflow/steps/:requestId', isProcessor, async (req, res) => {
  try {
    const requestId = parseInt(req.params.requestId);
    
    // Check if request exists
    const request = await prisma.rEQUESTS.findUnique({
      where: { REQUEST_ID: requestId }
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    
    // Check if user belongs to the same company as the request
    // @ts-ignore
    const userCompanyId = req.user?.COMPANY_ID;
    // Using type assertion since COMPANY_ID is not in the Prisma model but exists at runtime
    if ((request as any).COMPANY_ID !== userCompanyId && req.user?.role !== '1') {
      return res.status(403).json({ 
        message: 'You can only view workflow steps for your own group/organization' 
      });
    }
    
    // Get workflow steps
    const steps = await prisma.$queryRaw`
      SELECT ws.*, u.FIRST_NAME, u.LAST_NAME
      FROM WORKFLOW_STEPS ws
      LEFT JOIN USERS u ON ws.PROCESSED_BY = u.USER_ID
      WHERE ws.REQUEST_ID = ${requestId}
      ORDER BY ws.STEP_ORDER
    `;
    
    // Format the response
    const formattedSteps = (steps as any[]).map(step => ({
      STEP_ID: step.STEP_ID,
      REQUEST_ID: step.REQUEST_ID,
      STEP_NAME: step.STEP_NAME,
      STEP_DESCRIPTION: step.STEP_DESCRIPTION,
      STEP_ORDER: step.STEP_ORDER,
      STATUS: step.STATUS,
      COMMENTS: step.COMMENTS,
      PROCESSED_BY: step.PROCESSED_BY,
      PROCESSOR_NAME: step.FIRST_NAME && step.LAST_NAME ? `${step.FIRST_NAME} ${step.LAST_NAME}` : null,
      PROCESSED_DATE: step.PROCESSED_DATE
    }));
    
    res.json(formattedSteps);
  } catch (error) {
    console.error('Error fetching workflow steps:', error);
    res.status(500).json({ message: 'Failed to fetch workflow steps' });
  }
});

// Approve a request (shortcut for processors)
router.put('/requests/:id/approve', isProcessor, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    
    // Check if request exists
    const request = await prisma.rEQUESTS.findUnique({
      where: { REQUEST_ID: requestId }
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    
    // Check if user belongs to the same company as the request
    // @ts-ignore
    const userCompanyId = req.user?.COMPANY_ID;
    // Using type assertion since COMPANY_ID is not in the Prisma model but exists at runtime
    if ((request as any).COMPANY_ID !== userCompanyId && req.user?.role !== '1') {
      return res.status(403).json({ 
        message: 'You can only approve requests for your own group/organization' 
      });
    }
    
    // Update request status to approved
    await prisma.rEQUESTS.update({
      where: { REQUEST_ID: requestId },
      data: {
        STATUS: 'A',
        UPDATE_USER_ID: (req.user as any)?.id || null,
        UPDATE_DATE: new Date()
      }
    });
    
    // Create a task for the first workflow step if needed
    const firstStep = await prisma.$queryRaw`
      SELECT TOP 1 *
      FROM WORKFLOW_STEPS
      WHERE REQUEST_ID = ${requestId}
      ORDER BY STEP_ORDER
    `;
    
    if ((firstStep as any)[0]) {
      const stepData = (firstStep as any)[0];
      
      // Create a task for the first step
      await prisma.tASKS.create({
        data: {
          REQUEST_ID: requestId,
          DESCRIPTION: `Process workflow step: ${stepData.STEP_NAME}`,
          STATUS: 'P',
          ASSIGNED_USER_ID: stepData.ASSIGNED_USER_ID || (req.user as any)?.id || null,
          CREATE_USER_ID: (req.user as any)?.id || null,
          UPDATE_USER_ID: (req.user as any)?.id || null,
          CREATE_DATE: new Date(),
          UPDATE_DATE: new Date()
        }
      });
    }
    
    res.json({ message: 'Request approved successfully' });
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({ message: 'Failed to approve request' });
  }
});

// Complete a task (shortcut for processors)
router.put('/tasks/:id/complete', isProcessor, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    
    // Check if task exists
    const task = await prisma.tASKS.findUnique({
      where: { TASK_ID: taskId }
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Get the request to check company
    const request = await prisma.rEQUESTS.findUnique({
      where: { REQUEST_ID: task.REQUEST_ID }
    });
    
    // Check if user belongs to the same company as the request
    // @ts-ignore
    const userCompanyId = req.user?.COMPANY_ID;
    // Using type assertion since COMPANY_ID is not in the Prisma model but exists at runtime
    if (request && (request as any).COMPANY_ID !== userCompanyId && req.user?.role !== '1') {
      return res.status(403).json({ 
        message: 'You can only complete tasks for your own group/organization' 
      });
    }
    
    // Update task status to completed
    await prisma.tASKS.update({
      where: { TASK_ID: taskId },
      data: {
        STATUS: 'C',
        UPDATE_USER_ID: (req.user as any)?.id || null,
        UPDATE_DATE: new Date()
      }
    });
    
    res.json({ message: 'Task completed successfully' });
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ message: 'Failed to complete task' });
  }
});

export default router;

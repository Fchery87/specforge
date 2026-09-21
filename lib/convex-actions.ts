// lib/convex-actions.ts
// Typed Convex function references shared by client components

import { api } from "@/convex/_generated/api";

// Actions
export const generatePhaseAction = api.actions.generatePhase.generatePhase;
export const generateAllPhasesAction = api.actions.generateAllPhases.generateAllPhases;
export const generateQuestionsAction = api.actions.generateQuestions.generateQuestions;
export const generateAllQuestionAnswersAction = api.actions.generateAllQuestionAnswers.generateAllQuestionAnswers;
export const generateSectionPlanAction = api.actions.generateSectionPlan.generateSectionPlan;
export const generateQuestionAnswerAction = api.actions.generateQuestionAnswer.generateQuestionAnswer;
export const generateProjectZipAction = api.actions.generateProjectZip.generateProjectZip;
export const enhancePromptAction = api.actions.enhancePrompt.enhancePrompt;
export const scanCodebaseAction = api.actions.scanCodebase.scanCodebase;
export const generateQuickSpecAction = api.actions.generateQuickSpec.generateQuickSpec;
export const verifyImplementationAction = api.actions.verifyImplementation.verifyImplementation;
export const parseTicketsFromArtifactAction = api.actions.parseTickets.parseTicketsFromArtifact;

// Projects
export const createProjectAction = api.projects.createProject;
export const deleteProjectAction = api.projects.deleteProject;
export const getProjectAction = api.projects.getProject;
export const getProjectsAction = api.projects.getProjects;
export const getProjectPhasesAction = api.projects.getProjectPhases;
export const toggleSkipPhaseAction = api.projects.toggleSkipPhase;

// Constitution Templates
export const listTemplatesAction = api.constitutionTemplates.listTemplates;
export const incrementUsageCountAction = api.constitutionTemplates.incrementUsageCount;

// Codebase
export const getCodebaseAction = api.codebase.getCodebase;

// LLM Models
export const listEnabledModelsAction = api.llmModels.listEnabledModels;

// Artifacts
export const getArtifactByPhaseAction = api.artifacts.getArtifactByPhase;
export const getAllProjectArtifactsAction = api.artifacts.getAllProjectArtifacts;
export const cancelArtifactStreamingAction = api.artifacts.cancelArtifactStreaming;

// Project queries
export const getGenerationTaskAction = api.projects.getGenerationTask;
export const saveAnswerAction = api.projects.saveAnswer;
export const getPhaseAction = api.projects.getPhase;

// Admin
export const listAllModelsAction = api.admin.listAllModels;
export const addModelAction = api.admin.addModel;
export const deleteModelAction = api.admin.deleteModel;
export const updateModelAction = api.admin.updateModel;
export const listSystemCredentialsAction = api.admin.listSystemCredentials;

// System Credential Actions
export const setSystemCredentialAction = api.systemCredentialActions.setSystemCredential;
export const deleteSystemCredentialAction = api.systemCredentialActions.deleteSystemCredential;

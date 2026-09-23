import { Repository } from '../types';

export const mockRepo: Repository = {
  id: 'repo-1',
  name: 'SourceHub',
  owner: 'operator',
  description: 'Self-hosted single-operator git forge with native desktop source control and local CI.',
  visibility: 'private',
  defaultBranch: 'main',
  starsCount: 1,
  forksCount: 0,
  branches: ['main'],
  tags: ['v0.1.0-alpha'],
  updatedAt: 'recently',
};

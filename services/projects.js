import db from '../db/index';

export async function getProjects() {
  try {
    return db.projects.toArray();
  } catch (e) {
    console.error('[projects.getProjects]', e);
    return [];
  }
}

export async function getActiveProjects() {
  try {
    return db.projects.filter(p => p.status !== 'archived').toArray();
  } catch (e) {
    console.error('[projects.getActiveProjects]', e);
    return [];
  }
}

export async function addProject(data) {
  try {
    return db.projects.add({
      name: data.name,
      color: data.color || '#007AFF',
      icon: data.icon || '📁',
      status: 'active',
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[projects.addProject]', e);
    throw e;
  }
}

export async function updateProject(id, data) {
  try {
    return db.projects.update(id, data);
  } catch (e) {
    console.error('[projects.updateProject]', e);
    throw e;
  }
}

export async function archiveProject(id) {
  try {
    return db.projects.update(id, { status: 'archived' });
  } catch (e) {
    console.error('[projects.archiveProject]', e);
    throw e;
  }
}

export async function deleteProject(id) {
  try {
    // Unlink tasks from this project
    const tasks = await db.tasks.where('project_id').equals(id).toArray();
    for (const t of tasks) {
      await db.tasks.update(t.id, { project_id: null });
    }
    return db.projects.delete(id);
  } catch (e) {
    console.error('[projects.deleteProject]', e);
    throw e;
  }
}

export async function getProjectWithTasks(id) {
  try {
    const project = await db.projects.get(id);
    if (!project) return null;
    const tasks = await db.tasks.where('project_id').equals(id).toArray();
    return { ...project, tasks };
  } catch (e) {
    console.error('[projects.getProjectWithTasks]', e);
    return null;
  }
}

import { useState, useEffect, useCallback } from 'react';
import { seedExercises } from '../../services/exercises';
import { startWorkout, getWorkout, addExerciseToWorkout, cancelWorkout } from '../../services/workouts';
import { createTemplate, updateTemplate, deleteTemplate } from '../../services/templates';
import ConfirmSheet from '../../components/ConfirmSheet';
import FadeIn from '../../components/FadeIn';
import SportOverview from './SportOverview';
import ActiveWorkout from './ActiveWorkout';
import WorkoutSummary from './WorkoutSummary';
import WorkoutHistory from './WorkoutHistory';
import WorkoutDetail from './WorkoutDetail';
import ExerciseLibrary from './ExerciseLibrary';
import ExerciseDetail from './ExerciseDetail';
import TemplateEditor from './TemplateEditor';
import TemplateList from './TemplateList';
import BodyWeightLog from './BodyWeightLog';
import SportProgress from './SportProgress';
import VideoAnalysis from './VideoAnalysis';
import PRList from './PRList';
import MeasurementsScreen from './MeasurementsScreen';
import ProgressPhotos from './ProgressPhotos';
import AITrainerScreen from './AITrainerScreen';

export default function SportModule({ theme, onBack, initialView }) {
  const [view, setView] = useState(initialView || 'overview');
  const [activeWorkoutId, setActiveWorkoutId] = useState(null);
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [finishedWorkout, setFinishedWorkout] = useState(null);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(null);
  const [editTemplate, setEditTemplate] = useState(null);
  const [exercisePickerCallback, setExercisePickerCallback] = useState(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Seed exercises on first load
  useEffect(() => { seedExercises().catch(console.error); }, []);

  const navigate = useCallback(async (target, params = {}) => {
    switch (target) {
      case 'startWorkout': {
        const id = await startWorkout(params.templateId);
        const w = await getWorkout(id);
        setActiveWorkoutId(id);
        setActiveWorkout(w);
        setView('activeWorkout');
        break;
      }
      case 'workoutDetail':
        setSelectedWorkoutId(params.workoutId);
        setView('workoutDetail');
        break;
      case 'templateEditor':
        setEditTemplate(params.template || null);
        setView('templateEditor');
        break;
      case 'templateList':
        setView('templateList');
        break;
      case 'editTemplate':
        setEditTemplate(params.template);
        setView('templateEditor');
        break;
      case 'exerciseDetail':
        setSelectedExerciseId(params.exerciseId);
        setView('exerciseDetail');
        break;
      default:
        setView(target);
    }
  }, []);

  const goBack = () => {
    const backMap = {
      activeWorkout: 'overview',
      workoutSummary: 'overview',
      history: 'overview',
      workoutDetail: 'history',
      exercises: 'overview',
      exerciseDetail: 'exercises',
      templateEditor: 'templateList',
      templateList: 'overview',
      bodyWeight: 'overview',
      progress: 'overview',
      video: 'overview',
      aiTrainer: 'overview',
      exercisePicker: activeWorkoutId ? 'activeWorkout' : 'templateEditor',
    };
    setView(backMap[view] || 'overview');
    setEditTemplate(null);
    setExercisePickerCallback(null);
  };

  // Workout handlers
  const handleFinishWorkout = (result) => {
    setFinishedWorkout(result);
    setView('workoutSummary');
    setActiveWorkoutId(null);
    setActiveWorkout(null);
  };

  const handleCancelWorkout = async () => {
    if (activeWorkoutId) {
      setConfirmDialog({
        title: 'Отменить тренировку?',
        message: 'Данные не сохранятся',
        confirmLabel: 'Отменить тренировку',
        onConfirm: async () => {
          await cancelWorkout(activeWorkoutId);
          setActiveWorkoutId(null);
          setActiveWorkout(null);
          setView('overview');
        },
      });
    }
  };

  const handleAddExerciseToWorkout = () => {
    setExercisePickerCallback(() => async (exercise) => {
      await addExerciseToWorkout(activeWorkoutId, exercise);
      const w = await getWorkout(activeWorkoutId);
      setActiveWorkout(w);
      setView('activeWorkout');
      setExercisePickerCallback(null);
    });
    setView('exercisePicker');
  };

  // Template handlers
  const handleSaveTemplate = async (data) => {
    if (data.id) {
      await updateTemplate(data.id, data);
    } else {
      await createTemplate(data.name, data.exercises, data.day_of_week);
    }
    setView('overview');
    setEditTemplate(null);
  };

  const handleDeleteTemplate = async (id) => {
    setConfirmDialog({
      title: 'Удалить шаблон?',
      message: 'Это действие нельзя отменить',
      confirmLabel: 'Удалить',
      onConfirm: async () => {
        await deleteTemplate(id);
        setView('overview');
        setEditTemplate(null);
      },
    });
  };

  const handlePickExerciseForTemplate = (callback) => {
    setExercisePickerCallback(() => (exercise) => {
      callback(exercise);
      setView('templateEditor');
      setExercisePickerCallback(null);
    });
    setView('exercisePicker');
  };

  const renderView = () => {
    switch (view) {
      case 'overview':
        return <SportOverview theme={theme} onNavigate={navigate} onBack={onBack} activeWorkoutId={activeWorkoutId} />;

      case 'activeWorkout':
        return (
          <ActiveWorkout
            workoutId={activeWorkoutId}
            workout={activeWorkout}
            theme={theme}
            onFinish={handleFinishWorkout}
            onCancel={handleCancelWorkout}
            onAddExercise={handleAddExerciseToWorkout}
          />
        );

      case 'workoutSummary':
        return (
          <WorkoutSummary
            workout={finishedWorkout}
            theme={theme}
            onDone={() => { setFinishedWorkout(null); setView('overview'); }}
          />
        );

      case 'history':
        return (
          <WorkoutHistory
            theme={theme}
            onBack={goBack}
            onSelect={(id) => navigate('workoutDetail', { workoutId: id })}
          />
        );

      case 'workoutDetail':
        return <WorkoutDetail workoutId={selectedWorkoutId} theme={theme} onBack={goBack} />;

      case 'exercises':
        return <ExerciseLibrary theme={theme} onBack={goBack} onNavigate={navigate} />;

      case 'exerciseDetail':
        return <ExerciseDetail exerciseId={selectedExerciseId} theme={theme} onBack={goBack} onNavigate={navigate} />;

      case 'exercisePicker':
        return (
          <ExerciseLibrary
            theme={theme}
            onBack={goBack}
            selectMode
            onSelect={(ex) => exercisePickerCallback?.(ex)}
          />
        );

      case 'templateList':
        return (
          <TemplateList
            theme={theme}
            onBack={goBack}
            onStart={(id) => navigate('startWorkout', { templateId: id })}
            onEdit={(t) => navigate('templateEditor', { template: t })}
            onCreate={() => navigate('templateEditor', {})}
          />
        );

      case 'templateEditor':
        return (
          <TemplateEditor
            template={editTemplate}
            onSave={handleSaveTemplate}
            onDelete={handleDeleteTemplate}
            onClose={goBack}
            onPickExercise={handlePickExerciseForTemplate}
            theme={theme}
          />
        );

      case 'bodyWeight':
        return <BodyWeightLog theme={theme} onBack={goBack} />;

      case 'progress':
        return <SportProgress theme={theme} onBack={goBack} onNavigate={navigate} />;

      case 'prList':
        return <PRList theme={theme} onBack={goBack} />;

      case 'measurements':
        return <MeasurementsScreen theme={theme} onBack={goBack} />;
      case 'photos':
        return <ProgressPhotos theme={theme} onBack={goBack} />;

      case 'video':
        return <VideoAnalysis theme={theme} onBack={goBack} />;

      case 'aiTrainer':
        return <AITrainerScreen theme={theme} onBack={goBack}
          onStartWorkout={async (existingWorkoutId) => {
            if (existingWorkoutId) {
              const w = await getWorkout(existingWorkoutId);
              setActiveWorkoutId(existingWorkoutId);
              setActiveWorkout(w);
              setView('activeWorkout');
            } else {
              navigate('startWorkout');
            }
          }} />;

      default:
        return <SportOverview theme={theme} onNavigate={navigate} onBack={onBack} />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: theme.bg }}>
      <FadeIn key={view}>{renderView()}</FadeIn>
      <ConfirmSheet
        open={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        onConfirm={() => { confirmDialog?.onConfirm?.(); setConfirmDialog(null); }}
        theme={theme}
      />
    </div>
  );
}

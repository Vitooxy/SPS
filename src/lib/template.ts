import { downloadEditorWorkbook, type EditorData } from './build-workbook';

export function createTemplateEditorData(): EditorData {
  const categoryCodes: Record<string, string[]> = {
    Overload: ['General Overload', 'Pressure-Caused Overload', 'Crowd-Caused Overload', 'Strong-Visual-Stimulus-Caused Overload', 'Strong-Auditory-Stimulus-Caused Overload', 'Tactile Overload', 'Olfactory Overload', 'Gustatory Overload', 'Change-Related Overload', 'Conflict-Related Overload'],
    'Coping Behavior': ['Preventive Behavior', 'Recovery Behavior'],
    'Perceptual Sensitivity': ['Sensitivity to Subtlety', 'Sensitivity to Details', 'Sensitivity to Small Differences and Changes', 'Bodily-State Sensitivity'],
    'Affective and Aesthetic': ['Hedonic Sensitivity', 'Social Hedonic Sensitivity', 'Aesthetic Responsiveness', 'Aesthetic Sensitivity', 'Emotional Contagion', 'Inner Emotional Intensity'],
    'Social Cognition and Empathy': ['Cognitive Empathy', 'General Empathy', 'Nonverbal Social Perception', 'Evaluation Apprehension'],
    'Cognitive Processing': ['Deep Thought', 'Inner Richness', 'Mental Replay', 'Anticipatory Processing', 'Mental Overactivity', 'Intuitive Insight', 'Cognitive Disruption'],
    'Other Descriptors': ['Conscientious', 'Observer-Rated Sensitivity', 'Comparative', 'Reversed'],
  };
  const stimulus: Record<string, string[]> = {
    Physical: ['Visual', 'Auditory', 'Tactile', 'Gustatory', 'Olfactory', 'Thermoception'],
    Internal: ['Bodily State', 'Internal Mentation'],
    Social: ['Nonverbal Social Cues', "Other's Mood", 'Conflict', 'Crowd', 'Close Others', 'Artistic Stimuli', 'Linguistic'],
    Demand: ['Observation or Competition', 'Time/Task Pressure'],
    Configuration: ['Subtlety', 'Intense Input', 'Stimulus-Dense Environment', 'Changes', 'Uncertainty'],
    'Missing / Unspecified': ['Unspecified'],
  };
  const editor: EditorData = {
    items: [{
      id: 'HSP_1', sourceId: 'HSP_1', scale: 'HSP-27', text: 'Are you easily overwhelmed by strong sensory input?',
      derivedPrimary: 'General Overload', stimulus: 'Unspecified, Intense Input', process: '', outcome: 'ER_Negative',
      response: '', cognitiveDisp: '', outliner: '', originalPrimaryCode: 'Sensory overload',
    }],
    primaryCodeList: Object.entries(categoryCodes).flatMap(([category, codes]) => codes.map(code => ({ category, code }))),
    axisValueList: [
      ...Object.entries(stimulus).flatMap(([subcategory, values]) => values.map(value => ({ axis: 'Stimulus' as const, subcategory, value }))),
      ...['Detection', 'Discrimination', 'Appreciation', 'Inference', 'Anticipation', 'Action Knowledge', 'Affective Influence'].map(value => ({ axis: 'Process' as const, subcategory: '', value })),
      ...['ER_Negative', 'ER_Positive', 'ER_Unspecified', 'PR_Negative', 'CognitiveDisruption_Negative'].map(value => ({ axis: 'Outcome' as const, subcategory: '', value })),
      ...['Preventive Behavior', 'Recovery Behavior'].map(value => ({ axis: 'Response' as const, subcategory: '', value })),
      ...['Deep Thought', 'Inner Richness', 'Mental Overactivity', 'Intuition'].map(value => ({ axis: 'CognitiveDisp' as const, subcategory: '', value })),
    ],
  };
  return editor;
}

export function downloadTemplate() {
  downloadEditorWorkbook(createTemplateEditorData(), 'SPS-Coding-Template');
}

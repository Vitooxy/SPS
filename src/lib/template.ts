import * as XLSX from 'xlsx';

export function downloadTemplate() {
  const wb = XLSX.utils.book_new();

  // --- Sheet 1: Items × Axes ---
  const itemsHeaders = [
    'Row', 'Scale', 'Item ID', 'Item Text', 'Derived Primary Code', 'Outliner',
    'Stimulus Input', 'Process', 'Outcome and Appraised Valence', 'Response', 'Cognitive Disposition', 'Original Primary Code'
  ];
  const itemsSample = [
    [1, 'HSP-27', 'HSP_1', 'Emotional film scenes touch me deeply.', 'Aesthetic Responsiveness', '',
     'Visual, Auditory, Intense Input', 'Affective Engagement', 'Positive', 'Preventive Regulation', 'Sensitivity to Aesthetic', 'Aesthetic Responsiveness'],
    [2, 'HSP-27', 'HSP_2', 'I am easily overwhelmed by bright lights.', 'Visual Overload', '',
     'Visual, Intense Input', 'Sensory Information Processing', 'Negative', 'Withdrawal', 'Sensitivity to Overload', 'Visual Overload'],
    [3, 'HSP-27', 'HSP_3', 'I notice subtle changes in my environment.', 'Sensitivity to Subtlety', '',
     'Visual, Auditory, Olfactory, Subtlety', 'Sensory Information Processing', 'Neutral', 'Preventive Regulation', 'Sensitivity to Subtle Stimuli', 'Sensitivity to Subtlety'],
  ];
  const itemsSheet = XLSX.utils.aoa_to_sheet([itemsHeaders, ...itemsSample]);
  itemsSheet['!cols'] = [
    { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 50 },
    { wch: 28 }, { wch: 10 },
    { wch: 40 }, { wch: 30 }, { wch: 22 },
    { wch: 22 }, { wch: 28 }, { wch: 28 }
  ];
  XLSX.utils.book_append_sheet(wb, itemsSheet, 'Items × Axes');

  // --- Sheet 2: Primary Code List ---
  const pcHeaders = ['Level', 'Category', 'PrimaryCode'];
  const pcData = [
    ['Final', 'Overload', 'General Overload'],
    ['Final', 'Overload', 'Pressure-Caused Overload'],
    ['Final', 'Overload', 'Social Overload'],
    ['Final', 'Overload', 'Visual Overload'],
    ['Final', 'Overload', 'Auditory Overload'],
    ['Final', 'Overload', 'Tactile Overload'],
    ['Final', 'Overload', 'Olfactory Overload'],
    ['Final', 'Overload', 'Gustatory Overload'],
    ['Final', 'Aversion', 'Aversion to Change'],
    ['Final', 'Aversion', 'Aversion to Conflict'],
    ['Final', 'Aversion', 'Aversion to Uncertainty'],
    ['Final', 'Coping', 'Active Coping'],
    ['Final', 'Coping', 'Avoidance Coping'],
    ['Final', 'Coping', 'Preventive Regulation'],
    ['Final', 'Perceptual Sensitivity', 'Sensitivity to Subtlety'],
    ['Final', 'Perceptual Sensitivity', 'Sensitivity to Details'],
    ['Final', 'Perceptual Sensitivity', 'Difference Sensitivity'],
    ['Final', 'Perceptual Sensitivity', 'Bodily-State Sensitivity'],
    ['Final', 'Affective and Aesthetic', 'Hedonic Sensitivity'],
    ['Final', 'Affective and Aesthetic', 'Social Hedonic Sensitivity'],
    ['Final', 'Affective and Aesthetic', 'Aesthetic Sensitivity'],
    ['Final', 'Affective and Aesthetic', 'Aesthetic Responsiveness'],
    ['Final', 'Affective and Aesthetic', 'Emotional Contagion'],
    ['Final', 'Affective and Aesthetic', 'Inner Emotional Intensity'],
    ['Final', 'Social Cognition and Empathy', 'General Empathy'],
    ['Final', 'Social Cognition and Empathy', 'Cognitive Empathy'],
    ['Final', 'Social Cognition and Empathy', 'Nonverbal Social Perception'],
    ['Final', 'Social Cognition and Empathy', 'Evaluation Apprehension'],
    ['Final', 'Cognitive Processing', 'Deep Thought'],
    ['Final', 'Cognitive Processing', 'Inner Richness'],
    ['Final', 'Cognitive Processing', 'Mental Replay'],
    ['Final', 'Cognitive Processing', 'Anticipatory Processing'],
    ['Final', 'Cognitive Processing', 'Mental Overactivity'],
    ['Final', 'Cognitive Processing', 'Intuitive Insight'],
    ['Final', 'Cognitive Processing', 'Cognitive Disruption'],
    ['Final', 'Other Descriptors', 'Conscientious'],
    ['Final', 'Other Descriptors', 'Observer-Rated Sensitivity'],
    ['Final', 'Other Descriptors', 'Comparative Sensitivity'],
    ['Final', 'Other Descriptors', 'Reversed'],
  ];
  const pcSheet = XLSX.utils.aoa_to_sheet([pcHeaders, ...pcData]);
  pcSheet['!cols'] = [{ wch: 10 }, { wch: 28 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, pcSheet, 'Primary Code List');

  // --- Sheet 3: Axis Value List ---
  const avHeaders = ['Axis', 'Subcategory', 'Value'];
  const avData = [
    ['Stimulus Input', 'Physical', 'Visual'],
    ['Stimulus Input', 'Physical', 'Auditory'],
    ['Stimulus Input', 'Physical', 'Tactile'],
    ['Stimulus Input', 'Physical', 'Gustatory'],
    ['Stimulus Input', 'Physical', 'Olfactory'],
    ['Stimulus Input', 'Physical', 'Thermoception'],
    ['Stimulus Input', 'Internal', 'Bodily State'],
    ['Stimulus Input', 'Internal', 'Internal Mentation'],
    ['Stimulus Input', 'Social', 'Nonverbal Social Cues'],
    ['Stimulus Input', 'Social', "Other's Mood"],
    ['Stimulus Input', 'Social', 'Conflict'],
    ['Stimulus Input', 'Social', 'Crowd'],
    ['Stimulus Input', 'Social', 'Close Others'],
    ['Stimulus Input', 'Social', 'Artistic Stimuli'],
    ['Stimulus Input', 'Social', 'Linguistic'],
    ['Stimulus Input', 'Demand', 'Observation or Competition'],
    ['Stimulus Input', 'Demand', 'Time/Task Pressure'],
    ['Stimulus Input', 'Configuration', 'Subtlety'],
    ['Stimulus Input', 'Configuration', 'Intense Input'],
    ['Stimulus Input', 'Configuration', 'Stimulus-Dense Environment'],
    ['Stimulus Input', 'Configuration', 'Changes'],
    ['Stimulus Input', 'Configuration', 'Uncertainty'],
    ['Stimulus Input', 'Missing / Unspecified', 'Unspecified'],
    ['Process', '', 'Sensory Information Processing'],
    ['Process', '', 'Affective Engagement'],
    ['Process', '', 'Cognitive Appraisal'],
    ['Process', '', 'Higher-Order Cognitive Processing'],
    ['Process', '', 'Response Preparation'],
    ['Outcome and Appraised Valence', '', 'Positive'],
    ['Outcome and Appraised Valence', '', 'Negative'],
    ['Outcome and Appraised Valence', '', 'Neutral'],
    ['Outcome and Appraised Valence', '', 'Unspecified'],
    ['Response', '', 'Withdrawal'],
    ['Response', '', 'Active Coping'],
    ['Response', '', 'Preventive Regulation'],
    ['Cognitive Disposition', '', 'Sensitivity to Overload'],
    ['Cognitive Disposition', '', 'Sensitivity to Subtle Stimuli'],
    ['Cognitive Disposition', '', 'Sensitivity to Aesthetic'],
    ['Cognitive Disposition', '', 'Sensitivity to Social Stimuli'],
    ['Cognitive Disposition', '', 'Sensitivity to Bodily Cues'],
    ['Cognitive Disposition', '', 'Sensitivity to Reward'],
    ['Cognitive Disposition', '', 'Sensitivity to Change'],
    ['Cognitive Disposition', '', 'Sensitivity to Uncertainty'],
  ];
  const avSheet = XLSX.utils.aoa_to_sheet([avHeaders, ...avData]);
  avSheet['!cols'] = [{ wch: 36 }, { wch: 24 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, avSheet, 'Axis Value List');

  // Generate and download
  const wbData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbData], { type: 'application/octet-stream' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'SPS-Coding-Template.xlsx';
  a.click();
  window.URL.revokeObjectURL(url);
}
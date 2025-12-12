const STEPS = [
  { id: 1, name: 'Upload', icon: '📁' },
  { id: 2, name: 'Select', icon: '🎞️' },
  { id: 3, name: 'Edit', icon: '✂️' },
  { id: 4, name: 'Export', icon: '💾' },
]

export default function StepIndicator({ currentStep, onStepClick, maxReachedStep }) {
  return (
    <div className="step-indicator">
      {STEPS.map((step, index) => {
        const isActive = step.id === currentStep
        const isCompleted = step.id < currentStep
        const isClickable = step.id <= maxReachedStep

        return (
          <div key={step.id} className="step-wrapper">
            <button
              className={`step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isClickable ? 'clickable' : ''}`}
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
            >
              <span className="step-icon">{isCompleted ? '✓' : step.icon}</span>
              <span className="step-name">{step.name}</span>
            </button>
            {index < STEPS.length - 1 && (
              <div className={`step-connector ${isCompleted ? 'completed' : ''}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

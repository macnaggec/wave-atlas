import { Paper } from '@mantine/core';
import { useAddSpotFlow } from '../model/useAddSpotFlow';
import styles from './AddSpotPanel.module.css';
import { HintStep } from './steps/HintStep';
import { FormStep } from './steps/FormStep';
import { ProximityStep } from './steps/ProximityStep';

export function AddSpotPanel() {
  const flow = useAddSpotFlow();

  return (
    <Paper
      shadow="xl"
      radius="md"
      p="md"
      withBorder
      className={styles.panel}
    >
      {flow.step === 'hint' && (
        <HintStep onCancel={flow.cancel} />
      )}

      {flow.step === 'form' && (
        <FormStep
          name={flow.name}
          location={flow.location}
          nameError={flow.nameError}
          locationError={flow.locationError}
          isGeocoding={flow.isGeocoding}
          isSubmitting={flow.isSubmitting}
          onNameChange={flow.setName}
          onLocationChange={flow.setLocation}
          onBack={flow.backToPin}
          onCancel={flow.cancel}
          onSubmit={flow.submitForm}
        />
      )}

      {flow.step === 'proximity' && (
        <ProximityStep
          nearbySpots={flow.nearbySpots}
          isCreating={flow.isCreating}
          onGoToExisting={flow.goToExisting}
          onConfirmCreate={flow.confirmCreate}
          onBack={flow.backToForm}
          onCancel={flow.cancel}
        />
      )}
    </Paper>
  );
}


import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';
import { useMapStore } from 'widgets/GlobeMap/model/mapStore';
import { spotNameSchema, spotLocationSchema } from 'shared/validation/spotSchemas';
import { notify } from 'shared/lib/notifications';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { useReverseGeocode } from './useReverseGeocode';
import type { Spot } from 'entities/Spot/types';

export type AddSpotStep = 'hint' | 'form' | 'proximity';

export interface AddSpotFlowState {
  step: AddSpotStep;
  name: string;
  location: string;
  isGeocoding: boolean;
  nearbySpots: Spot[];
  /** Nearby check + create both pending — drives the FormStep submit button. */
  isSubmitting: boolean;
  /** Create mutation pending only — drives the ProximityStep confirm button. */
  isCreating: boolean;
  nameError: string | null;
  locationError: string | null;
  setName: (v: string) => void;
  setLocation: (v: string) => void;
  cancel: () => void;
  backToPin: () => void;
  backToForm: () => void;
  submitForm: () => void;
  confirmCreate: () => void;
  goToExisting: (spot: Spot) => void;
}

export function useAddSpotFlow(): AddSpotFlowState {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    tempPin,
    pendingSpotName,
    exitPinPlacement,
    clearTempPin
  } = useMapStore();

  const [step, setStep] = useState<AddSpotStep>('hint');
  const [name, setName] = useState(pendingSpotName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [nearbySpots, setNearbySpots] = useState<Spot[]>([]);
  const [isCheckingNearby, setIsCheckingNearby] = useState(false);

  const {
    location,
    isLoading: isGeocoding,
    geocode,
    setLocation
  } = useReverseGeocode();

  const createMutation = useMutation(trpc.spots.create.mutationOptions());

  useEffect(() => {
    if (tempPin && step === 'hint') {
      setStep('form');
      geocode(tempPin);
    }
  }, [tempPin, step, geocode]);

  const cancel = useCallback(() => {
    exitPinPlacement();
  }, [exitPinPlacement]);

  const backToPin = useCallback(() => {
    clearTempPin();
    setStep('hint');
    setLocation('');
  }, [clearTempPin, setLocation]);

  const create = useCallback(async () => {
    if (!tempPin) return;

    const spot = await createMutation.mutateAsync({
      name: name.trim(),
      location: location.trim(),
      lat: tempPin[1],
      lng: tempPin[0],
    });

    queryClient.setQueryData(
      trpc.spots.list.queryKey(),
      (prev: Spot[] = []) => [...prev, spot],
    );

    exitPinPlacement();

    void navigate({ to: '/$spotId/upload', params: { spotId: spot.id } });
  }, [
    tempPin,
    name,
    location,
    createMutation,
    queryClient,
    trpc,
    exitPinPlacement,
    navigate
  ]);

  const handleSetName = useCallback((v: string) => {
    setName(v);
    setNameError(null);
  }, []);

  const handleSetLocation = useCallback((v: string) => {
    setLocation(v);
    setLocationError(null);
  }, []);

  const handleSubmitForm = useCallback(async () => {
    if (!tempPin) return;
    const nameResult = spotNameSchema.safeParse(name.trim());
    const locationResult = spotLocationSchema.safeParse(location.trim());
    if (!nameResult.success) setNameError(nameResult.error.issues[0].message);
    if (!locationResult.success) setLocationError(locationResult.error.issues[0].message);
    if (!nameResult.success || !locationResult.success) return;
    setIsCheckingNearby(true);
    try {
      const nearby = await queryClient.fetchQuery(
        trpc.spots.nearby.queryOptions({ lat: tempPin[1], lng: tempPin[0] }),
      );
      if (nearby.length > 0) {
        setNearbySpots(nearby);
        setStep('proximity');
      } else {
        await create();
      }
    } catch (err) {
      notify.error(getErrorMessage(err), 'Failed to create spot');
    } finally {
      setIsCheckingNearby(false);
    }
  }, [tempPin, name, location, queryClient, trpc, create]);

  const goToExisting = useCallback((spot: Spot) => {
    exitPinPlacement();
    void navigate({ to: '/$spotId/upload', params: { spotId: spot.id } });
  }, [exitPinPlacement, navigate]);

  return {
    step,
    name,
    location,
    isGeocoding,
    nearbySpots,
    nameError,
    locationError,
    isSubmitting: isCheckingNearby || createMutation.isPending,
    isCreating: createMutation.isPending,
    setName: handleSetName,
    setLocation: handleSetLocation,
    cancel,
    backToPin,
    backToForm: () => setStep('form'),
    submitForm: () => { void handleSubmitForm(); },
    confirmCreate: () => { void create(); },
    goToExisting,
  };
}

# ml-service (offline experiment)

`CropPredictionTrainer.java` / `train-model.ts` train a Weka Random Forest on **synthetic rows generated from hand-written
district rules**. The "100 % accuracy" in `crop_model.json` therefore only shows that the forest re-learned those rules; it is **not**
a real-world performance estimate and must not be quoted as one.

The production advisory (E1-US9..11) uses `backend/src/services/cropAdvisor.ts`: a transparent scoring engine whose
factors (district fit, rotation, soil pH, rainfall) are returned to the farmer. To replace it with a trained model later you need
real labelled history (district, season, previous crop, soil tests → yield/profit) from the hub's own collections.

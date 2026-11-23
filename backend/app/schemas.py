from pydantic import BaseModel, Field


class IrisFeatures(BaseModel):
    """Les 4 features du dataset Iris (en cm)."""

    sepal_length: float = Field(..., ge=0, le=10, examples=[5.1], description="Longueur du sépale (cm)")
    sepal_width: float = Field(..., ge=0, le=10, examples=[3.5], description="Largeur du sépale (cm)")
    petal_length: float = Field(..., ge=0, le=10, examples=[1.4], description="Longueur du pétale (cm)")
    petal_width: float = Field(..., ge=0, le=10, examples=[0.2], description="Largeur du pétale (cm)")

    def to_row(self) -> list[float]:
        return [self.sepal_length, self.sepal_width, self.petal_length, self.petal_width]


class PredictionResponse(BaseModel):
    species: str
    class_id: int
    probabilities: dict[str, float]
    model_version: str


class BatchRequest(BaseModel):
    items: list[IrisFeatures] = Field(..., min_length=1, max_length=100)


class BatchResponse(BaseModel):
    predictions: list[PredictionResponse]


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool

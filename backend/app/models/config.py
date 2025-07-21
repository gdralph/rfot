from sqlmodel import SQLModel, Field
from typing import Optional
from pydantic import validator


class OpportunityCategoryBase(SQLModel):
    """Base opportunity category model."""
    name: str
    min_tcv: float
    max_tcv: Optional[float] = None

    @validator('min_tcv')
    def validate_min_tcv(cls, v):
        if v < 0:
            raise ValueError('Minimum TCV must be non-negative')
        return v

    @validator('max_tcv')
    def validate_max_tcv(cls, v, values):
        if v is not None:
            if v < 0:
                raise ValueError('Maximum TCV must be non-negative')
            if 'min_tcv' in values and v <= values['min_tcv']:
                raise ValueError('Maximum TCV must be greater than minimum TCV')
        return v


class OpportunityCategory(OpportunityCategoryBase, table=True):
    """Opportunity category database model."""
    id: Optional[int] = Field(default=None, primary_key=True)


class OpportunityCategoryCreate(OpportunityCategoryBase):
    """Model for creating opportunity categories."""
    pass


class OpportunityCategoryRead(OpportunityCategoryBase):
    """Model for reading opportunity categories."""
    id: int


class StageEffortEstimateBase(SQLModel):
    """Base stage effort estimate model."""
    category_id: int = Field(foreign_key="opportunitycategory.id")
    stage_name: str
    default_effort_weeks: float
    default_duration_weeks: int

    @validator('default_effort_weeks', 'default_duration_weeks')
    def validate_positive(cls, v):
        if v <= 0:
            raise ValueError('Effort and duration must be positive')
        return v


class StageEffortEstimate(StageEffortEstimateBase, table=True):
    """Stage effort estimate database model."""
    id: Optional[int] = Field(default=None, primary_key=True)


class StageEffortEstimateCreate(StageEffortEstimateBase):
    """Model for creating stage effort estimates."""
    pass


class StageEffortEstimateRead(StageEffortEstimateBase):
    """Model for reading stage effort estimates."""
    id: int


class SMEAllocationRuleBase(SQLModel):
    """Base SME allocation rule model."""
    team_name: str
    service_line: Optional[str] = None  # CES, INS, BPS, SEC, ITOC, MW
    effort_per_million: float

    @validator('effort_per_million')
    def validate_effort_per_million(cls, v):
        if v < 0:
            raise ValueError('Effort per million must be non-negative')
        return v


class SMEAllocationRule(SMEAllocationRuleBase, table=True):
    """SME allocation rule database model."""
    id: Optional[int] = Field(default=None, primary_key=True)


class SMEAllocationRuleCreate(SMEAllocationRuleBase):
    """Model for creating SME allocation rules."""
    pass


class SMEAllocationRuleRead(SMEAllocationRuleBase):
    """Model for reading SME allocation rules."""
    id: int
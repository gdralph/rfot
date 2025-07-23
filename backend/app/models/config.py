from sqlmodel import SQLModel, Field
from typing import Optional
from pydantic import field_validator, ConfigDict


class OpportunityCategoryBase(SQLModel):
    """Base opportunity category model."""
    name: str
    min_tcv: float
    max_tcv: Optional[float] = None
    # Stage duration fields (in weeks)
    stage_01_duration_weeks: float = 0.0
    stage_02_duration_weeks: float = 0.0
    stage_03_duration_weeks: float = 0.0
    stage_04a_duration_weeks: float = 0.0
    stage_04b_duration_weeks: float = 0.0
    stage_05a_duration_weeks: float = 0.0
    stage_05b_duration_weeks: float = 0.0
    stage_06_duration_weeks: float = 0.0

    @field_validator('min_tcv')
    @classmethod
    def validate_min_tcv(cls, v):
        if v < 0:
            raise ValueError('Minimum TCV must be non-negative')
        return v

    @field_validator('max_tcv')
    @classmethod
    def validate_max_tcv(cls, v, info):
        if v is not None:
            if v < 0:
                raise ValueError('Maximum TCV must be non-negative')
            if info.data and 'min_tcv' in info.data and v <= info.data['min_tcv']:
                raise ValueError('Maximum TCV must be greater than minimum TCV')
        return v
    
    @field_validator('stage_01_duration_weeks', 'stage_02_duration_weeks', 'stage_03_duration_weeks',
                     'stage_04a_duration_weeks', 'stage_04b_duration_weeks', 'stage_05a_duration_weeks',
                     'stage_05b_duration_weeks', 'stage_06_duration_weeks')
    @classmethod
    def validate_duration_weeks(cls, v):
        if v < 0:
            raise ValueError('Duration weeks must be non-negative')
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


class OpportunityCategoryUpdate(OpportunityCategoryBase):
    """Model for updating opportunity categories."""
    pass


class ServiceLineCategoryBase(SQLModel):
    """Base service line category model for service-line-specific TCV thresholds."""
    service_line: str
    name: str
    min_tcv: float
    max_tcv: Optional[float] = None

    @field_validator('service_line')
    @classmethod
    def validate_service_line(cls, v):
        allowed_service_lines = ['MW', 'ITOC']
        if v not in allowed_service_lines:
            raise ValueError(f'Service line must be one of: {allowed_service_lines}')
        return v

    @field_validator('min_tcv')
    @classmethod
    def validate_min_tcv(cls, v):
        if v < 0:
            raise ValueError('Minimum TCV must be non-negative')
        return v

    @field_validator('max_tcv')
    @classmethod
    def validate_max_tcv(cls, v, info):
        if v is not None:
            if v < 0:
                raise ValueError('Maximum TCV must be non-negative')
            if info.data and 'min_tcv' in info.data and v <= info.data['min_tcv']:
                raise ValueError('Maximum TCV must be greater than minimum TCV')
        return v


class ServiceLineCategory(ServiceLineCategoryBase, table=True):
    """Service line category database model."""
    id: Optional[int] = Field(default=None, primary_key=True)


class ServiceLineCategoryCreate(ServiceLineCategoryBase):
    """Model for creating service line categories."""
    pass


class ServiceLineCategoryRead(ServiceLineCategoryBase):
    """Model for reading service line categories."""
    id: int


class ServiceLineCategoryUpdate(ServiceLineCategoryBase):
    """Model for updating service line categories."""
    pass





class ServiceLineStageEffortBase(SQLModel):
    """Base service line stage effort model."""
    service_line: str  # MW, ITOC
    service_line_category_id: int = Field(foreign_key="servicelinecategory.id")
    stage_name: str
    fte_required: float

    @field_validator('service_line')
    @classmethod
    def validate_service_line(cls, v):
        allowed_service_lines = ['MW', 'ITOC']
        if v not in allowed_service_lines:
            raise ValueError(f'Service line must be one of: {allowed_service_lines}')
        return v

    @field_validator('fte_required')
    @classmethod
    def validate_fte_required(cls, v):
        if v < 0:
            raise ValueError('FTE required must be non-negative')
        return v



class ServiceLineStageEffort(ServiceLineStageEffortBase, table=True):
    """Service line stage effort database model."""
    id: Optional[int] = Field(default=None, primary_key=True)


class ServiceLineStageEffortCreate(ServiceLineStageEffortBase):
    """Model for creating service line stage efforts."""
    pass


class ServiceLineStageEffortRead(ServiceLineStageEffortBase):
    """Model for reading service line stage efforts."""
    id: int
    
    model_config = ConfigDict(from_attributes=True)


class ServiceLineStageEffortUpdate(ServiceLineStageEffortBase):
    """Model for updating service line stage efforts."""
    pass
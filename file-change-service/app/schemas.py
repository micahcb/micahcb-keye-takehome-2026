from pydantic import BaseModel


class RowActionRequest(BaseModel):
    fileId: str
    rowId: str
    action: str


class FileActionRequest(BaseModel):
    fileId: str
    action: str


class SampleUploadRequest(BaseModel):
    sampleFileName: str

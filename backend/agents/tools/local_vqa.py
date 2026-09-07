import torch
from PIL import Image
from transformers import BlipProcessor, BlipForQuestionAnswering


class LocalVQAEngine:
    """Free local VQA inference using Salesforce BLIP."""

    def __init__(self):
        self.model_name = "Salesforce/blip-vqa-base"
        self.processor = BlipProcessor.from_pretrained(self.model_name)
        self.model = BlipForQuestionAnswering.from_pretrained(self.model_name)
        self.model.eval()

    def answer(self, image_path: str, question: str) -> str:
        image = Image.open(image_path).convert("RGB")

        inputs = self.processor(
            images=image,
            text=question,
            return_tensors="pt",
        )

        with torch.no_grad():
            output = self.model.generate(
                **inputs,
                max_new_tokens=50,
            )

        answer = self.processor.decode(
            output[0],
            skip_special_tokens=True,
        ).strip()

        return answer


_local_vqa = None


def get_local_vqa():
    global _local_vqa

    if _local_vqa is None:
        _local_vqa = LocalVQAEngine()

    return _local_vqa

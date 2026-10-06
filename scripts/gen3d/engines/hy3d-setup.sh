#!/bin/bash
set -x
source ~/miniforge3/bin/activate
conda create -y -n hy3d python=3.10 || true
conda activate hy3d
conda install -y -c nvidia/label/cuda-12.8.1 cuda-toolkit cuda-nvcc cuda-cudart-dev
export CUDA_HOME=$CONDA_PREFIX TORCH_CUDA_ARCH_LIST=12.0 MAX_JOBS=14
pip install torch==2.8.0 torchvision==0.23.0 --index-url https://download.pytorch.org/whl/cu128
[ -d ~/Hunyuan3D-2 ] || git clone https://github.com/Tencent/Hunyuan3D-2.git ~/Hunyuan3D-2
cd ~/Hunyuan3D-2
pip install -r requirements.txt
pip install -e .
cd hy3dgen/texgen/custom_rasterizer && pip install . --no-build-isolation && cd ../../..
cd hy3dgen/texgen/differentiable_renderer && pip install . --no-build-isolation && cd ../../..
pip install "huggingface_hub[hf_xet]"
hf download tencent/Hunyuan3D-2mv --include "hunyuan3d-dit-v2-mv/*"
hf download tencent/Hunyuan3D-2 --include "hunyuan3d-paint-v2-0-turbo/*" "hunyuan3d-delight-v2-0/*" "hunyuan3d-vae-v2-0/*"
python -c "import torch, hy3dgen; print('HY3D-OK', torch.cuda.is_available())"
echo HY3D-SETUP-DONE

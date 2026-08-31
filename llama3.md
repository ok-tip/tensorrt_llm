## Dependencies

```
pip install pyyaml tabulate rich
```

## Workflows

| Workflow  | Description              | Supported Steps                                      |
|-----------|--------------------------|------------------------------------------------------|
| `legacy`  | Compiled TRT-LLM engine  | download, convert, build, data, throughput, summary, clean |
| `pytorch` | HF-based inference       | download, data, throughput, summary, clean           |

## Steps

| Step         | Description                                              | Output                                              |
|--------------|----------------------------------------------------------|-----------------------------------------------------|
| `download`   | Fetch HF checkpoint                                      | `hf-models/<model>/`                               |
| `convert`    | Convert HF → TRT-LLM checkpoint (legacy only)           | `ckpts/<model>/<quant>/pp<P>-tp<T>/`               |
| `build`      | Compile TRT-LLM engine (legacy only)                    | `engines/<model>/<quant>/pp<P>-tp<T>-sl<S>-tk<T>-bs<B>/` |
| `data`       | Generate synthetic datasets                              | `datasets/synthetic-il<N>-ol<N>-rq<N>.txt`        |
| `throughput` | Run `trtllm-bench`, sweep over all cases                | `throughput/<model>/<quant>/pp<P>-tp<T>/output-...-<ts>.log` |
| `summary`    | Print throughput table; scan all historical logs        | `logs/summary-<config>-<workflow>-<model>-<ts>.log` |
| `clean`      | Delete artifacts scoped to exact config combinations    | —                                                   |

## Config

```yaml
workflow: pytorch                         
sif: tensorrt_llm_v1.2.0.sif
model: nvidia/Llama-3.1-70B-Instruct-FP8

# parallelism
pp_sizes: [1]
tp_sizes: [1, 2, 4, 8]

# engine parameters
max_seq_len: 4096
max_num_tokens: [8192]
max_batch_sizes: [2048]

# throughput
workloads:
  - {input_mean: 128,  output_mean: 128,  num_requests: 30000}
  - {input_mean: 128,  output_mean: 2048, num_requests: 3000}
  - {input_mean: 2048, output_mean: 128,  num_requests: 3000}

kv_cache_fraction: 0.95
```

## Usage

```bash
./llama3.py --config config.yaml <steps>
```

Steps are comma-separated with no spaces:

```bash
# pytorch — full run
./llama3.py --config config.yaml download,data,throughput,summary

# legacy — full run
./llama3.py --config config.yaml download,convert,build,data,throughput,summary

# summary only (scans all historical logs)
./llama3.py --config config.yaml summary

# clean artifacts for this config
./llama3.py --config config.yaml clean
```

## Field Codes

| Code | Meaning           |
|------|-------------------|
| `il` | input_mean        |
| `ol` | output_mean       |
| `rq` | num_requests      |
| `pp` | pipeline_parallel |
| `tp` | tensor_parallel   |
| `sl` | max_seq_len       |
| `tk` | max_num_tokens    |
| `bs` | max_batch_size    |
| `ts` | run timestamp     |

## Result: H200 SXM 141 GB

```
  pipeline    tensor    input len    output len    requests    max tokens    batch size    run timestamp    Throughput (tok/s)
----------  --------  -----------  ------------  ----------  ------------  ------------  ---------------  --------------------
         1         1          128           128       30000          8192          2048  20260415-114432                  3644
         1         1          128          2048        3000          8192          2048  20260415-114432                  4086
         1         1         2048           128        3000          8192          2048  20260415-114432                   461
         1         2          128           128       30000          8192          2048  20260415-114432                  6667
         1         2          128          2048        3000          8192          2048  20260415-114432                  6274
         1         2         2048           128        3000          8192          2048  20260415-114432                   789
         1         4          128           128       30000          8192          2048  20260415-114432                 10698
         1         4          128          2048        3000          8192          2048  20260415-114432                 11674
         1         4         2048           128        3000          8192          2048  20260415-114432                  1283
         1         8          128           128       30000          8192          2048  20260415-114432                 15487
         1         8          128          2048        3000          8192          2048  20260415-114432                 24066
         1         8         2048           128        3000          8192          2048  20260415-114432                  1884
```


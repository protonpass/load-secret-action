# pass-cli-load-secret-action

GitHub Action that installs the [Proton Pass CLI](https://github.com/protonpass/pass-cli) and resolves secrets from Proton Pass into the workflow, either as step outputs or as environment variables.

Secrets are identified by scanning the step's environment variables for values that start with `pass://`. Each matching variable is resolved and its value is masked in all subsequent log output.

## Usage

### Export secrets as step outputs

```yaml
- name: Load secrets
  id: load_secrets
  uses: protonpass/pass-cli-load-secret-action@v1
  env:
    PROTON_PASS_PERSONAL_ACCESS_TOKEN: ${{ secrets.PROTON_PAT }}
    DB_PASSWORD: pass://MyVault/Database/password
    API_KEY: pass://MyVault/ApiService/key

- name: Use the secrets
  run: deploy --password "${{ steps.load_secrets.outputs.DB_PASSWORD }}"
```

### Export secrets as environment variables

```yaml
- name: Load secrets
  uses: protonpass/pass-cli-load-secret-action@v1
  with:
    export-env: 'true'
  env:
    PROTON_PASS_PERSONAL_ACCESS_TOKEN: ${{ secrets.PROTON_PAT }}
    DB_PASSWORD: pass://MyVault/Database/password

- name: Use the secrets
  run: deploy --password "$DB_PASSWORD"
  # Prints: deploy --password ***
```

### Pin the CLI version and provide the hash

```yaml
- name: Load secrets
  uses: protonpass/pass-cli-load-secret-action@v1
  with:
    version: '2.1.4'
    hash: '60d54456726378d80917de0e05d2e102697ee043b7e420a34d55c8437ced89f2'
  env:
    PROTON_PASS_PERSONAL_ACCESS_TOKEN: ${{ secrets.PROTON_PAT }}
    MY_SECRET: pass://MyVault/MyItem/MyField
```

### Using install-cli-action in a prior step

If `pass-cli` is already in `PATH` (e.g. from a previous `install-cli-action` step), this action skips the download. If a valid session is already present (e.g. from a prior `pass-cli-load-secret-action` step in the same job), it also skips login.

```yaml
- uses: protonpass/install-cli-action@v1
  with:
    version: '2.1.4'

- uses: protonpass/pass-cli-load-secret-action@v1
  env:
    PROTON_PASS_PERSONAL_ACCESS_TOKEN: ${{ secrets.PROTON_PAT }}
    MY_SECRET: pass://MyVault/MyItem/MyField
```

## Inputs

| Input        | Required | Default     | Description                                                                                                               |
| ------------ | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| `version`    | No       | `latest`    | Version of `pass-cli` to install. Ignored if `pass-cli` is already in `PATH`.                                             |
| `hash`       | No       |             | Expected SHA256 hash of the downloaded binary. When omitted the hash is fetched from the official `.sha256` release file. |
| `platform`   | No       | auto-detect | Target platform. Accepted values: `linux-aarch64`, `linux-x86_64`, `macos-aarch64`, `macos-x86_64`, `windows-x86_64`.     |
| `export-env` | No       | `false`     | When `true`, resolved secrets are also exported as environment variables for subsequent steps.                            |

## Environment variables

| Variable                            | Required | Description                                                                                               |
| ----------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `PROTON_PASS_PERSONAL_ACCESS_TOKEN` | Yes      | Personal access token used to authenticate with Proton Pass.                                              |
| `<ANY_NAME>`                        | No       | Any environment variable whose value starts with `pass://` is treated as a secret reference and resolved. |

## Secret URI format

```
pass://<vault>/<item>/<field>
```

Examples:

```
pass://MyVault/DatabaseCredentials/password
pass://CI/ApiKeys/stripe-secret
```

## Outputs

Every resolved secret is set as a step output using the same name as the environment variable that held the `pass://` reference. Values are masked before being written to any output.

| Output       | Description                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| `<VAR_NAME>` | The resolved secret value, masked in logs. One output per `pass://` reference found in the step environment. |

## Security

- All secret values are masked immediately after resolution via `core.setSecret()`. They will appear as `***` in any subsequent log output.
- The personal access token is masked as soon as it is read.
- SHA256 verification is always performed when downloading the CLI binary.
- Errors from the CLI subprocess do not include the secret value in the error message.

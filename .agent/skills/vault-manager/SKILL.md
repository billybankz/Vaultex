---
name: vault-manager
description: Manages the HashiCorp Vault lifecycle and security policies.
---
# Vault Manager Skill
When the user asks to manage the vault, follow these security protocols:

## Administrative Rules
1. **Zero-Visibility:** Admins can only use the 'unseal' or 'reset' commands. They must NEVER call `vault kv get` on user paths.
2. **User Isolation:** Every user must have their own path in Vault: `secret/data/users/{{username}}/*`.
3. **Audit Trails:** Every action must be logged to the terminal for the 'Password History' requirement.

## Commands to use:
- To start: `docker run -d --name vault-dev -p 8200:8200 -e 'VAULT_DEV_ROOT_TOKEN_ID=dev-token' hashicorp/vault`
- To reset a user: Re-generate a token for their specific path without reading the path contents.

use crate::models::types::AppError;
use keyring::Entry;

const KEYRING_SERVICE: &str = "LlamaManager";
const KEYRING_USERNAME: &str = "github_token";

pub struct CredentialManager;

impl CredentialManager {
    /// Save GitHub token to encrypted keyring
    pub fn save_github_token(token: &str) -> Result<(), AppError> {
        let entry = Entry::new(KEYRING_SERVICE, KEYRING_USERNAME)
            .map_err(|e| AppError::Generic(format!("Failed to create keyring entry: {}", e)))?;
        entry.set_password(token)
            .map_err(|e| AppError::Generic(format!("Failed to save GitHub token: {}", e)))
    }

    /// Get GitHub token from encrypted keyring
    pub fn get_github_token() -> Result<Option<String>, AppError> {
        let entry = Entry::new(KEYRING_SERVICE, KEYRING_USERNAME)
            .map_err(|e| AppError::Generic(format!("Failed to create keyring entry: {}", e)))?;
        // get_password returns Err when no entry exists
        match entry.get_password() {
            Ok(token) => Ok(Some(token)),
            Err(_) => Ok(None),
        }
    }

    /// Delete GitHub token from keyring
    pub fn delete_github_token() -> Result<(), AppError> {
        let entry = Entry::new(KEYRING_SERVICE, KEYRING_USERNAME)
            .map_err(|e| AppError::Generic(format!("Failed to create keyring entry: {}", e)))?;

        // Ignore errors - entry may not exist, and deleting a non-existent entry
        // still achieves the desired end state (no token present)
        let _ = entry.delete_credential();
        Ok(())
    }

    /// Check if a GitHub token exists in the keyring
    pub fn has_github_token() -> Result<bool, AppError> {
        Ok(Self::get_github_token()?.is_some())
    }
}

# Mission: Zero-Knowledge Internal Password Vault

## Objectives
1. **Infrastructure:** Launch a Dockerized HashiCorp Vault in 'Dev' mode.
2. **Frontend:** Create a React app with a URL accessible locally.
3. **Security Flow:** 
   - Users log in with a username. 
   - The app uses the username to fetch/store data in Vault under `secret/users/<username>`.
   - **Crucial:** Implement client-side encryption. The password the user types is encrypted in the browser before being sent to the Vault URL.
4. **Admin Panel:** Create a separate route `/admin` where an admin can "Reset" a user's vault (clear the path) but cannot "Read" it.

## Success Criteria
- [ ] User can save a password and see it after refresh.
- [ ] Admin can see a list of users.
- [ ] Admin *cannot* click a button to reveal a user's password.

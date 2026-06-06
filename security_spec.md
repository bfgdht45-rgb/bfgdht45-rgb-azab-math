# Security Specification for Math Pro

## Data Invariants
1. A user profile cannot be created by anyone other than the user themselves (except by admin).
2. A course must have a valid teacher (an approved teacher profile).
3. An enrollment must reference both a valid user and a valid approved course.
4. Revenue and student counting are protected from arbitrary manipulation.
5. Roles and status are immutable by users and can only be changed by the Master Admin.

## The Dirty Dozen (Attack Scenarios)
1. **Identity Spoofing**: Creating a `users/{userId}` document where `uid` doesn't match `request.auth.uid`.
2. **Privilege Escalation**: Attempting to set `role: 'admin'` or `status: 'approved'` during registration.
3. **Ghost Fields**: Adding `isVerified: true` to a course to bypass logic.
4. **Data Poisoning**: Injecting 1MB of text into the `title` or `displayName` field.
5. **ID Hijacking**: Using a huge junk string as `{courseId}` to cause billable overhead (denial of wallet).
6. **Price Manipulation**: Updating a course price to `0.01` while not being the teacher.
7. **Phantom Enrollment**: Enrolling someone else in a course.
8. **Revenue Drain**: Resetting a course's `revenue` to `0` as a student.
9. **Role Stealing**: Changing another teacher's course `teacherId` to self.
10. **Timestamp Faking**: Setting `createdAt` to a future date manually.
11. **Status Lock-Bypass**: Attempting to approve one's own pending course.
12. **Anonymous Scraping**: List querying users without being authenticated.

## Test Runner (Logic Outline)
The tests will verify that:
- `create` on `/users/{u}` fails if `uid != u` or `role == 'admin'`.
- `update` on `/courses/{c}` fails if `incoming().price != existing().price` while only updating content.
- `list` on `/enrollments` fails for unauthenticated users.

# docs

| File                              | What it is                                                           |
| --------------------------------- | -------------------------------------------------------------------- |
| `STRUCTURE.md`                    | Every file and folder of this repo, and how a request travels        |
| `adr/`                            | Architecture Decision Records for the whole project, plus a template |
| `postman_collection.json`         | Every auth and courses request, ready to run in Postman              |
| `postman_environment.json`        | Variables for the collection (API address, a seeded email, password) |
| SRS v1.1, architecture, plan PDFs | Add the project documents here so everyone reads the same version    |
| `handover/`                       | Handover notes before the Day 15 swap (one page per intern)          |

## Using the Postman collection

1. Postman → Import → choose both JSON files. Select the **EduRecords local** environment.
2. Run **Auth → Login**. It saves `accessToken` and `instituteId` (the first institute) for you.
3. Run any **Courses** request. To try another institute, copy an id from the Login response
   into the `instituteId` variable.
4. Try the security checks: set `instituteId` to an institute the user cannot access and
   expect **403**. (Only the two admin users are seeded, and both may create courses.)

Never put real student data in screenshots, Postman examples or WhatsApp.

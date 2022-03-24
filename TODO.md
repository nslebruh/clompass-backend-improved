
# Todo 

## firebase realtime database

- ### On subject get request:
        get lesson plans

        format data

        check if subject exists in database
            make get request for database subject list

        if subject exists: 
            - if new plan's nodeId in subject:
                pass
            - if not:
                append new plan to write object
        if not: 
            append all new plans to write object
        
        if write object isn't empty: 
            write object to database
        if not: 
            pass

- ### setup listener for new lesson plans
        create listener on subjects

        if subject changes: 
            process new lesson plans
        

- ### create new get/lessonplan endpoint
        pass through subject and nodeId from req.query

        send get request for subject
        if subject exists: 
            if NodeId exists: 
                return lesson plan
            if not: 
                return
        if not: 
            return 





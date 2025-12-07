import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  CircularDependencyError,
  MissingDependencyError,
  MissingWorkCenterError,
} from './types';

/**
 * Exception filter that transforms domain errors into HTTP responses.
 */
@Catch(CircularDependencyError, MissingDependencyError, MissingWorkCenterError)
export class ReflowExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof CircularDependencyError) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'CircularDependencyError',
        message: exception.message,
        cycle: exception.cycle,
      });
    }

    if (exception instanceof MissingDependencyError) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'MissingDependencyError',
        message: exception.message,
        workOrderId: exception.workOrderId,
        missingDependencyId: exception.missingDependencyId,
      });
    }

    if (exception instanceof MissingWorkCenterError) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'MissingWorkCenterError',
        message: exception.message,
        workOrderId: exception.workOrderId,
        workCenterId: exception.workCenterId,
      });
    }
  }
}

